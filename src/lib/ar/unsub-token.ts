/**
 * Signed one-click unsubscribe tokens.
 *
 * Format: base64url(payload) + "." + base64url(hmac_sha256(AR_UNSUB_SECRET, payload))
 * Payload JSON: { c: contactId, s: 'all' | sequenceId, v: 1 }
 *
 * Tokens don't expire — unsubscribe links need to work forever. Rotation of
 * AR_UNSUB_SECRET is a breaking change for already-sent emails, so treat it
 * like a long-lived secret.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

type UnsubPayload = {
  c: string; // contact id
  s: string; // 'all' or a sequence id
  v: 1;
};

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function secret(): Buffer {
  const raw = process.env.AR_UNSUB_SECRET;
  if (!raw) throw new Error('AR_UNSUB_SECRET is required');
  return Buffer.from(raw, 'utf8');
}

export function signUnsubToken(contactId: string, scope: 'all' | string): string {
  const payload: UnsubPayload = { c: contactId, s: scope, v: 1 };
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = b64url(createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyUnsubToken(token: string): UnsubPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret()).update(body).digest();
  const got = b64urlDecode(sig);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const json = JSON.parse(b64urlDecode(body).toString('utf8')) as UnsubPayload;
    if (json.v !== 1 || typeof json.c !== 'string' || typeof json.s !== 'string') return null;
    return json;
  } catch {
    return null;
  }
}
