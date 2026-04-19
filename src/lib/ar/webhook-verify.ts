/**
 * Svix webhook signature verification. Resend signs outgoing webhooks with
 * Svix; the format is:
 *
 *   headers:
 *     svix-id: msg_xxx
 *     svix-timestamp: <unix seconds>
 *     svix-signature: v1,<base64 sig> [v1,<base64 sig>]...
 *
 *   content to sign: `${id}.${timestamp}.${raw_body}`
 *   key: secret is `whsec_<base64 key>`; strip prefix, base64 decode
 *   signature: HMAC-SHA256(key, content), base64 encoded
 *
 * We accept any matching `v1,...` entry for key rotation. Timestamps older
 * than 5 minutes are rejected to block replays.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 5 * 60;

export function verifySvixSignature(params: {
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  rawBody: string;
  secret: string;
}): { ok: true } | { ok: false; reason: string } {
  const { id, timestamp, signatureHeader, rawBody, secret } = params;

  if (!id || !timestamp || !signatureHeader) return { ok: false, reason: 'missing_headers' };
  if (!secret.startsWith('whsec_')) return { ok: false, reason: 'bad_secret_format' };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad_timestamp' };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS)
    return { ok: false, reason: 'timestamp_out_of_tolerance' };

  const keyBytes = Buffer.from(secret.slice('whsec_'.length), 'base64');
  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', keyBytes).update(signed).digest();

  const entries = signatureHeader
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const [version, sig] = entry.split(',');
    if (version !== 'v1' || !sig) continue;
    const got = Buffer.from(sig, 'base64');
    if (got.length === expected.length && timingSafeEqual(got, expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'signature_mismatch' };
}
