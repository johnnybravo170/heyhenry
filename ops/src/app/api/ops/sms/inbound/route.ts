/**
 * POST /api/ops/sms/inbound — Twilio webhook for inbound SMS to the
 * support number. Allowlisted senders only; messages become kanban cards
 * tagged for the scheduled triage agent.
 *
 * Required env:
 *   TWILIO_AUTH_TOKEN          (already set, used to verify webhook signature)
 *   OPS_SMS_INBOUND_ALLOWLIST  comma-separated E.164 numbers, e.g.
 *                              "+17789087888,+15551234567"
 *   OPS_SMS_INBOUND_URL        the public URL Twilio is configured to POST to
 *                              (must match exactly for signature verification)
 *
 * Twilio sends application/x-www-form-urlencoded with fields:
 *   From, To, Body, MessageSid, AccountSid, NumMedia, MediaUrl0..N
 *
 * We respond with 200 + empty TwiML so Twilio doesn't auto-reply with the
 * "Sorry, can't process" template. (To send an outbound ack, use sendOpsSms
 * separately — the Twilio response body is for TwiML only and we don't want
 * to enrich the support reply via TwiML.)
 */

import crypto from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { createCard } from '@/server/ops-services/kanban';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return twimlError(500, 'TWILIO_AUTH_TOKEN unset');

  const allowlist = parseAllowlist(process.env.OPS_SMS_INBOUND_ALLOWLIST);
  const expectedUrl = process.env.OPS_SMS_INBOUND_URL;
  if (!expectedUrl) return twimlError(500, 'OPS_SMS_INBOUND_URL unset');

  const rawBody = await req.text();
  const params = new URLSearchParams(rawBody);

  // Verify Twilio signature.
  const signature = req.headers.get('x-twilio-signature') ?? '';
  if (!verifyTwilioSignature(authToken, expectedUrl, params, signature)) {
    return twimlError(403, 'Invalid signature');
  }

  const from = params.get('From') ?? '';
  const body = (params.get('Body') ?? '').trim();
  const sid = params.get('MessageSid') ?? '';

  if (!allowlist.has(from)) {
    // Silent drop — don't tip off non-allowlisted senders that the number
    // is anything other than a plain unmonitored line.
    return new NextResponse(EMPTY_TWIML, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  }

  if (!body) {
    return new NextResponse(EMPTY_TWIML, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  }

  // Collect MMS attachments (Twilio numbers them MediaUrl0..N).
  const numMedia = Number.parseInt(params.get('NumMedia') ?? '0', 10) || 0;
  const mediaUrls: string[] = [];
  for (let i = 0; i < numMedia; i += 1) {
    const url = params.get(`MediaUrl${i}`);
    if (url) mediaUrls.push(url);
  }

  await createCard(
    {
      actorType: 'agent',
      actorName: `sms-intake (${from})`,
      keyId: null,
      adminUserId: null,
    },
    {
      boardSlug: 'dev',
      title: truncateTitle(body),
      body: renderBody({ from, body, sid, mediaUrls }),
      tags: ['triage:claude', 'inbox-from-sms'],
    },
  );

  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
}

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Twilio signature: base64(HMAC-SHA1(authToken, url + sortedParamConcat))
 * where sortedParamConcat = key1value1key2value2... over POST params
 * sorted alphabetically by key.
 * Spec: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: URLSearchParams,
  signature: string,
): boolean {
  if (!signature) return false;
  const keys = Array.from(params.keys()).sort();
  let data = url;
  for (const key of keys) {
    data += key + (params.get(key) ?? '');
  }
  const expected = crypto.createHmac('sha1', authToken).update(data).digest('base64');
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function truncateTitle(message: string): string {
  const oneLine = message.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 80) return oneLine;
  return `${oneLine.slice(0, 77)}…`;
}

function renderBody(input: {
  from: string;
  body: string;
  sid: string;
  mediaUrls: string[];
}): string {
  const lines = [
    `**From inbound SMS**`,
    '',
    `> ${input.body.replace(/\n/g, '\n> ')}`,
    '',
    `**Sender:** ${input.from}`,
    `**Twilio SID:** ${input.sid}`,
  ];
  if (input.mediaUrls.length > 0) {
    lines.push('', '**Attachments:**');
    for (const url of input.mediaUrls) lines.push(`- ${url}`);
  }
  lines.push('', `_Logged ${new Date().toISOString()}_`);
  return lines.join('\n');
}

function twimlError(status: number, message: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><!-- ${message} --></Response>`,
    { status, headers: { 'Content-Type': 'application/xml' } },
  );
}
