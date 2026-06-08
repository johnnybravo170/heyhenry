/**
 * Shared Postmark-backed email send used by both the REST route
 * (`/api/ops/email/send`) and the MCP tools (`ops_email_send`,
 * `ops_digest_send`).
 *
 * Keeps the Postmark HTTP call + validation + audit-logging in one place so
 * routes/tools don't each re-implement the wire format. Raw fetch (no SDK)
 * to stay dependency-light — ops only ever sends transactional mail.
 *
 * Reuses the main app's Postmark setup: the `outbound-transactional` stream
 * and the verified `noreply@mail.heyhenry.io` sender. Point the ops
 * `POSTMARK_SERVER_TOKEN` at the same Postmark server as the app and senders
 * + streams work with no extra config.
 *
 * Env:
 *   POSTMARK_SERVER_TOKEN    — required, server token for the Postmark account
 *   OPS_EMAIL_DEFAULT_FROM   — optional `from` override (must be a verified
 *                              Postmark sender); defaults to the app's
 *                              transactional sender
 *   OPS_POSTMARK_STREAM      — optional message-stream override
 */
import { createServiceClient } from '@/lib/supabase';

const POSTMARK_API = 'https://api.postmarkapp.com/email';
const DEFAULT_FROM = 'HeyHenry <noreply@mail.heyhenry.io>';
const MESSAGE_STREAM = process.env.OPS_POSTMARK_STREAM || 'outbound-transactional';

export type EmailTag = { name: string; value: string };

export type SendEmailInput = {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
  tags?: EmailTag[];
};

export type SendEmailResult =
  | { ok: true; id: string; to: string[]; subject: string }
  | { ok: false; status: number; error: string };

const MAX_PAYLOAD_BYTES = 200 * 1024; // 200KB soft cap

export function validateEmailInput(
  input: SendEmailInput,
): { ok: true } | { ok: false; error: string } {
  if (!input.subject || input.subject.length < 1 || input.subject.length > 250) {
    return { ok: false, error: 'subject must be 1–250 chars' };
  }
  if (!input.html && !input.text) {
    return { ok: false, error: 'at least one of html or text is required' };
  }
  const size =
    Buffer.byteLength(input.subject, 'utf8') +
    (input.html ? Buffer.byteLength(input.html, 'utf8') : 0) +
    (input.text ? Buffer.byteLength(input.text, 'utf8') : 0);
  if (size > MAX_PAYLOAD_BYTES) {
    return { ok: false, error: `payload exceeds 200KB (${size} bytes)` };
  }
  return { ok: true };
}

/**
 * Send an email via Postmark and write an audit_log row with the outcome.
 *
 * `auditKeyId` is the ops.api_keys.id for REST callers, `null` for OAuth.
 * `auditPath` is the logical path to stamp on the audit row so both the
 * REST route and the MCP tool can share this function.
 */
export async function sendOpsEmail(
  input: SendEmailInput,
  audit: { keyId: string | null; path: string; method?: string },
): Promise<SendEmailResult> {
  const validation = validateEmailInput(input);
  if (!validation.ok) {
    await writeAudit(audit, 400, validation.error);
    return { ok: false, status: 400, error: validation.error };
  }

  const apiKey = process.env.POSTMARK_SERVER_TOKEN;
  if (!apiKey) {
    const msg = 'POSTMARK_SERVER_TOKEN not set';
    await writeAudit(audit, 500, msg);
    return { ok: false, status: 500, error: msg };
  }

  const from = input.from ?? process.env.OPS_EMAIL_DEFAULT_FROM ?? DEFAULT_FROM;
  const toList = Array.isArray(input.to) ? input.to : [input.to];

  // Postmark takes a comma-separated To string and a single Tag + Metadata
  // map (vs Resend's name/value tag array). Fold the tags in: Metadata keeps
  // every pair; Tag takes the `kind` value (the digest convention) or the
  // first pair so categorization still works in the Postmark dashboard.
  const payload: Record<string, unknown> = {
    From: from,
    To: toList.join(', '),
    Subject: input.subject,
    MessageStream: MESSAGE_STREAM,
    // Transactional ops mail — no open/link tracking (matches the app's
    // transactional stream; agent/alert mail doesn't need engagement signal).
    TrackOpens: false,
    TrackLinks: 'None',
  };
  if (input.html) payload.HtmlBody = input.html;
  if (input.text) payload.TextBody = input.text;
  if (input.reply_to) payload.ReplyTo = input.reply_to;
  if (input.tags?.length) {
    payload.Metadata = Object.fromEntries(input.tags.map((t) => [t.name, t.value]));
    const kind = input.tags.find((t) => t.name === 'kind');
    payload.Tag = (kind ?? input.tags[0]).value;
  }

  let res: Response;
  try {
    res = await fetch(POSTMARK_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': apiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeAudit(audit, 500, msg);
    return { ok: false, status: 500, error: msg };
  }

  const bodyText = await res.text();
  let body: { MessageID?: string; Message?: string; ErrorCode?: number } = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = {};
  }

  // Postmark signals failure via non-2xx AND a non-zero ErrorCode.
  if (!res.ok || (body.ErrorCode != null && body.ErrorCode !== 0)) {
    const msg = body.Message ?? `Postmark ${res.status}`;
    await writeAudit(audit, 500, `postmark: ${msg}`);
    return { ok: false, status: res.ok ? 502 : res.status, error: msg };
  }

  const id = body.MessageID ?? '';
  await writeAudit(audit, 200, `subject=${input.subject.slice(0, 100)}`);
  return { ok: true, id, to: toList, subject: input.subject };
}

async function writeAudit(
  audit: { keyId: string | null; path: string; method?: string },
  status: number,
  reason: string,
) {
  try {
    const service = createServiceClient();
    await service
      .schema('ops')
      .from('audit_log')
      .insert({
        key_id: audit.keyId,
        method: audit.method ?? 'POST',
        path: audit.path,
        status,
        reason: reason.slice(0, 500),
      });
  } catch {
    // never let audit failure break the send path
  }
}

export function postmarkConfigured(): boolean {
  return Boolean(process.env.POSTMARK_SERVER_TOKEN);
}
