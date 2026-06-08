/**
 * Retry wrapper for Gemini (`@google/genai`) generateContent calls.
 *
 * The raw SDK does NOT retry transient failures. Under load Gemini returns
 * 503 UNAVAILABLE ("model is currently experiencing high demand") and 429
 * RESOURCE_EXHAUSTED — both transient and usually cleared by a retry.
 * Without this, one blip fails a whole cron run (e.g. the weekly maintenance
 * digest writes the error string into its body instead of the summary).
 *
 * Retries on 429 / 5xx with exponential backoff + jitter. Non-retryable
 * errors (4xx / bad request) re-throw immediately, and the last error is
 * re-thrown once attempts are exhausted so the caller's existing catch
 * still runs.
 */
import type { GoogleGenAI } from '@google/genai';

// Derive param/result types straight from the SDK class so we don't depend
// on the package's named type exports staying stable across versions.
type GenParams = Parameters<GoogleGenAI['models']['generateContent']>[0];
type GenResult = Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_PATTERN =
  /\b(429|500|502|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|DEADLINE_EXCEEDED|overloaded|high demand/i;

export function isRetryableGeminiError(err: unknown): boolean {
  if (err == null) return false;
  const e = err as { status?: unknown; code?: unknown; message?: unknown };
  const status =
    typeof e.status === 'number' ? e.status : typeof e.code === 'number' ? e.code : undefined;
  if (typeof status === 'number' && RETRYABLE_STATUS.has(status)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return RETRYABLE_PATTERN.test(msg);
}

export type GeminiRetryOptions = {
  /** Total attempts including the first. Default 4. */
  maxAttempts?: number;
  /** Base backoff in ms (doubles each retry). Default 500. */
  baseDelayMs?: number;
  /** Cap on a single backoff in ms. Default 8000. */
  maxDelayMs?: number;
  /** Called before each retry sleep — wire to logging for visibility. */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
};

export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: GenParams,
  opts: GeminiRetryOptions = {},
): Promise<GenResult> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 4);
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const maxDelayMs = opts.maxDelayMs ?? 8000;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !isRetryableGeminiError(err)) throw err;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const delayMs = Math.round(backoff + Math.random() * backoff * 0.25);
      opts.onRetry?.({ attempt, delayMs, error: err });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}
