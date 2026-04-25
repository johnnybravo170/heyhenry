'use server';

/**
 * In-app feedback intake — calls ops.heyhenry.io's /api/ops/feedback with
 * the standard HMAC-signed request format. Cards land on the ops dev
 * board tagged for the scheduled triage agent.
 *
 * Required env (HeyHenry app):
 *   OPS_FEEDBACK_KEY  — full ops_<keyId>_<secret> token, scope=write:feedback
 *   OPS_BASE_URL      — e.g. https://ops.heyhenry.io (no trailing slash)
 */

import crypto from 'node:crypto';
import { requireTenant } from '@/lib/auth/helpers';

export type FeedbackResult = { ok: true; cardId: string } | { ok: false; error: string };

export async function submitFeedbackAction(input: {
  message: string;
  url?: string;
  userAgent?: string;
}): Promise<FeedbackResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: 'Empty message.' };
  if (message.length > 8000) return { ok: false, error: 'Message too long (8000 char max).' };

  const { user, tenant } = await requireTenant();

  const rawKey = process.env.OPS_FEEDBACK_KEY;
  const baseUrl = process.env.OPS_BASE_URL;
  if (!rawKey || !baseUrl) {
    return { ok: false, error: 'Server missing OPS_FEEDBACK_KEY or OPS_BASE_URL.' };
  }

  const parsed = parseOpsKey(rawKey);
  if (!parsed) return { ok: false, error: 'Server has malformed OPS_FEEDBACK_KEY.' };

  const path = '/api/ops/feedback';
  const bodyJson = JSON.stringify({
    message,
    submitter: user.email ?? `tenant:${tenant.id.slice(0, 8)}`,
    url: input.url,
    user_agent: input.userAgent,
    tenant_id: tenant.id,
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodySha = crypto.createHash('sha256').update(bodyJson).digest('hex');
  const signature = crypto
    .createHmac('sha256', parsed.secret)
    .update(`${timestamp}|POST|${path}|${bodySha}`)
    .digest('hex');

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rawKey}`,
        'X-Ops-Timestamp': timestamp,
        'X-Ops-Signature': signature,
      },
      body: bodyJson,
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `ops ${res.status}: ${text || res.statusText}` };
  }

  const json = (await res.json().catch(() => null)) as { ok?: boolean; card_id?: string } | null;
  if (!json?.ok || !json.card_id) {
    return { ok: false, error: 'Ops returned unexpected response.' };
  }
  return { ok: true, cardId: json.card_id };
}

function parseOpsKey(raw: string): { keyId: string; secret: string } | null {
  if (!raw.startsWith('ops_')) return null;
  const rest = raw.slice(4);
  const underscore = rest.indexOf('_');
  if (underscore < 0) return null;
  const keyId = rest.slice(0, underscore);
  const secret = rest.slice(underscore + 1);
  if (!keyId || secret.length < 20) return null;
  return { keyId, secret };
}
