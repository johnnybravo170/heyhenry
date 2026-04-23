/**
 * Minimal Twilio wrapper for the ops app.
 *
 * The main app has a richer client at src/lib/twilio/client.ts, but it's
 * tied to per-tenant logging and opt-out tables that don't exist in the
 * ops domain. Ops escalations are platform-level pings to Jonathan, so
 * we just need a thin SMS send.
 *
 * Reuses the same env vars the main app uses:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_DEFAULT (or TWILIO_FROM_US as fallback)
 *   OPS_ESCALATION_PHONE — the destination (Jonathan's mobile, E.164)
 */

import twilio, { type Twilio } from 'twilio';

let _client: Twilio | null = null;

function getClient(): Twilio {
  if (!_client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    }
    _client = twilio(sid, token);
  }
  return _client;
}

export type SendOpsSmsResult = { ok: true; sid: string } | { ok: false; error: string };

export async function sendOpsSms(body: string): Promise<SendOpsSmsResult> {
  const to = process.env.OPS_ESCALATION_PHONE;
  if (!to) {
    return { ok: false, error: 'OPS_ESCALATION_PHONE env var not set' };
  }
  const from = process.env.TWILIO_FROM_DEFAULT ?? process.env.TWILIO_FROM_US;
  if (!from) {
    return { ok: false, error: 'No Twilio from-number configured' };
  }

  try {
    const msg = await getClient().messages.create({ from, to, body });
    return { ok: true, sid: msg.sid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
