/**
 * Per-token rate limiting for the remote MCP endpoint.
 *
 * Implementation: a tiny rolling-minute counter table (`ops.mcp_rate_counters`)
 * with an atomic plpgsql bump function. One row per (token_id, minute_bucket).
 * The counter resets implicitly when the bucket changes, and the helper
 * opportunistically prunes rows older than 5 minutes (best-effort, fire-and-
 * forget — never blocks the request path).
 *
 * Default: 120 requests/minute/token. Override via MCP_RATE_LIMIT_PER_MIN.
 */
import { createServiceClient } from './supabase';

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function getMcpRateLimit(): number {
  const raw = process.env.MCP_RATE_LIMIT_PER_MIN;
  if (!raw) return 120;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120;
}

export async function enforceRateLimit(
  tokenId: string,
  limitPerMinute: number = getMcpRateLimit(),
): Promise<RateLimitResult> {
  const service = createServiceClient();
  const now = new Date();
  const bucket = new Date(Math.floor(now.getTime() / 60_000) * 60_000);

  const { data, error } = await service.schema('ops').rpc('bump_mcp_rate_counter', {
    p_token_id: tokenId,
    p_bucket: bucket.toISOString(),
  });

  // If the counter machinery breaks, fail open — better to serve than to
  // brick the agent on infra trouble. Audit log will still capture volume.
  if (error || typeof data !== 'number') return { ok: true };

  // Best-effort cleanup of rows from older buckets. Don't await.
  const cutoff = new Date(now.getTime() - 5 * 60_000).toISOString();
  void service.schema('ops').from('mcp_rate_counters').delete().lt('minute_bucket', cutoff);

  if (data > limitPerMinute) {
    const retryAfterSec = Math.max(1, 60 - Math.floor((now.getTime() % 60_000) / 1000));
    return { ok: false, retryAfterSec };
  }
  return { ok: true };
}
