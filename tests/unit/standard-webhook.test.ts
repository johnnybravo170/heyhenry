/**
 * Standard Webhooks signature verification — auth-critical, so cover the
 * accept path plus every rejection branch (bad sig, tampered body, expired
 * timestamp, missing headers, secret-prefix tolerance).
 */

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyStandardWebhook } from '@/lib/webhooks/standard-webhook';

const SECRET_B64 = Buffer.from('super-secret-signing-key').toString('base64');
const SECRET = `v1,whsec_${SECRET_B64}`;

function sign(secretB64: string, id: string, timestamp: string, body: string): string {
  const key = Buffer.from(secretB64, 'base64');
  const sig = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return `v1,${sig}`;
}

const NOW = 1_700_000_000;
const ID = 'msg_123';
const BODY = JSON.stringify({ user: { email: 'a@b.com' } });

function validHeaders(timestamp = String(NOW)) {
  return {
    id: ID,
    timestamp,
    signature: sign(SECRET_B64, ID, timestamp, BODY),
  };
}

describe('verifyStandardWebhook', () => {
  it('accepts a correctly signed payload', () => {
    expect(
      verifyStandardWebhook({ secret: SECRET, body: BODY, headers: validHeaders(), now: NOW }),
    ).toBe(true);
  });

  it('tolerates bare whsec_ and bare base64 secret forms', () => {
    const h = validHeaders();
    expect(
      verifyStandardWebhook({ secret: `whsec_${SECRET_B64}`, body: BODY, headers: h, now: NOW }),
    ).toBe(true);
    expect(verifyStandardWebhook({ secret: SECRET_B64, body: BODY, headers: h, now: NOW })).toBe(
      true,
    );
  });

  it('rejects a tampered body', () => {
    expect(
      verifyStandardWebhook({
        secret: SECRET,
        body: `${BODY} `,
        headers: validHeaders(),
        now: NOW,
      }),
    ).toBe(false);
  });

  it('rejects a forged signature', () => {
    expect(
      verifyStandardWebhook({
        secret: SECRET,
        body: BODY,
        headers: { id: ID, timestamp: String(NOW), signature: 'v1,not-a-real-signature' },
        now: NOW,
      }),
    ).toBe(false);
  });

  it('rejects an expired timestamp (outside tolerance)', () => {
    expect(
      verifyStandardWebhook({
        secret: SECRET,
        body: BODY,
        headers: validHeaders(String(NOW - 6 * 60)),
        now: NOW,
      }),
    ).toBe(false);
  });

  it('rejects when the signing secret is wrong', () => {
    const wrong = `v1,whsec_${Buffer.from('different-key').toString('base64')}`;
    expect(
      verifyStandardWebhook({ secret: wrong, body: BODY, headers: validHeaders(), now: NOW }),
    ).toBe(false);
  });

  it('rejects missing headers and empty secret', () => {
    expect(
      verifyStandardWebhook({
        secret: SECRET,
        body: BODY,
        headers: { id: null, timestamp: String(NOW), signature: 'x' },
        now: NOW,
      }),
    ).toBe(false);
    expect(
      verifyStandardWebhook({ secret: '', body: BODY, headers: validHeaders(), now: NOW }),
    ).toBe(false);
  });

  it('matches when multiple space-delimited signatures are present', () => {
    const good = sign(SECRET_B64, ID, String(NOW), BODY);
    expect(
      verifyStandardWebhook({
        secret: SECRET,
        body: BODY,
        headers: { id: ID, timestamp: String(NOW), signature: `v1,bogus ${good}` },
        now: NOW,
      }),
    ).toBe(true);
  });
});
