/**
 * Standard Webhooks (standardwebhooks.com) signature verification.
 *
 * Supabase's Send Email Hook signs each delivery with this scheme. Rather
 * than pull in the `standardwebhooks` package, we implement the (small,
 * stable) verification directly — matching the hand-rolled token/signature
 * pattern already used for QBO state and the Postmark outbound webhook.
 *
 * Secret format: Supabase stores the hook secret as `v1,whsec_<base64>`.
 * The signing key is the base64-decoded bytes after the `whsec_` prefix.
 *
 * Headers (case-insensitive):
 *   - `webhook-id`        — unique delivery id
 *   - `webhook-timestamp` — unix seconds
 *   - `webhook-signature` — space-delimited list of `v1,<base64-hmac>`
 *
 * Signed content is `${id}.${timestamp}.${body}` (raw request body, not
 * re-serialized JSON). The HMAC-SHA256 over that, base64-encoded, must match
 * one of the listed `v1` signatures.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 5 * 60;

export type StandardWebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

function decodeSecret(secret: string): Buffer {
  // Tolerate `v1,whsec_<b64>`, `whsec_<b64>`, or a bare base64 secret.
  let s = secret.trim();
  const comma = s.indexOf(',');
  if (s.startsWith('v1,')) s = s.slice(comma + 1);
  if (s.startsWith('whsec_')) s = s.slice('whsec_'.length);
  return Buffer.from(s, 'base64');
}

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify a Standard Webhooks signature. Returns true only if the timestamp
 * is within tolerance and at least one provided signature matches.
 */
export function verifyStandardWebhook(input: {
  secret: string;
  body: string;
  headers: StandardWebhookHeaders;
  now?: number;
}): boolean {
  const { secret, body, headers } = input;
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return false;

  let key: Buffer;
  try {
    key = decodeSecret(secret);
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const signedContent = `${id}.${timestamp}.${body}`;
  const expected = createHmac('sha256', key).update(signedContent).digest('base64');

  // The header is a space-delimited list of `<version>,<signature>`.
  for (const part of signature.split(' ')) {
    const comma = part.indexOf(',');
    if (comma === -1) continue;
    const version = part.slice(0, comma);
    const sig = part.slice(comma + 1);
    if (version !== 'v1') continue;
    if (constantTimeEquals(expected, sig)) return true;
  }
  return false;
}
