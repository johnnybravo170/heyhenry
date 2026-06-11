/**
 * Alert hook — emails the operator when a provider failure needs manual
 * attention.
 *
 * Two alert paths with different trigger conditions:
 *
 * 1. onAttempt — fires per-attempt for `quota`. A drained account needs
 *    fixing even if a fallback provider saved the call. Rate-limit and
 *    overload are NOT alerted here — they're transient and the fallback
 *    chain usually handles them without operator involvement.
 *
 * 2. onCallFailed — fires only when the entire fallback chain is
 *    exhausted. Used for overload / rate_limit / timeout — conditions
 *    where a single mid-chain failure is noise but total chain failure
 *    genuinely needs attention.
 *
 * Debounce: an `ai_alerts` row per (provider, kind) holds the last-sent
 * timestamp. The atomic claim runs as a single statement so two parallel
 * attempts can't both fire an email. Window defaults to 15 minutes; can
 * be tuned with AI_ALERT_DEBOUNCE_MINUTES.
 *
 * Recipient: AI_ALERT_EMAIL (env). If unset, the hook no-ops — explicit
 * opt-in, no surprise emails when the env isn't configured (e.g. in
 * preview deploys or local dev).
 */

import { sendEmail } from '@/lib/email/send';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AiErrorKind } from './errors';
import type { RouterAttemptEvent, RouterCallFailedEvent, RouterHooks } from './router-types';

/** Alert on every attempt — account-level problems that need fixing
 *  regardless of whether a fallback saved the call. */
const ATTEMPT_ALERT_KINDS: ReadonlySet<AiErrorKind> = new Set(['quota']);

/** Alert only when the entire chain fails — transient conditions where
 *  a single mid-chain failure is normal fallback behaviour. */
const CALL_FAILED_ALERT_KINDS: ReadonlySet<AiErrorKind> = new Set([
  'overload',
  'rate_limit',
  'timeout',
  'unknown',
]);

const DEFAULT_DEBOUNCE_MINUTES = 15;

export function createAlertHook(): RouterHooks {
  return {
    onAttempt: (event: RouterAttemptEvent) => {
      if (event.outcome !== 'error') return;
      if (!event.error_kind || !ATTEMPT_ALERT_KINDS.has(event.error_kind)) return;
      void maybeAlertAttempt(event).catch(() => {});
    },
    onCallFailed: (event: RouterCallFailedEvent) => {
      if (!CALL_FAILED_ALERT_KINDS.has(event.error_kind)) return;
      void maybeAlertCallFailed(event).catch(() => {});
    },
  };
}

async function maybeAlertAttempt(event: RouterAttemptEvent): Promise<void> {
  const recipient = process.env.AI_ALERT_EMAIL?.trim();
  if (!recipient) return;

  const debounceMinutes = parseDebounceMinutes();
  const claimed = await claimAlertSlot(
    event.provider,
    event.error_kind ?? 'unknown',
    debounceMinutes,
  );
  if (!claimed) return;

  const subject = `[HeyHenry AI] ${event.error_kind} on ${event.provider}`;
  const html = `
    <p>An AI provider hit a <strong>${escapeHtml(event.error_kind ?? 'unknown')}</strong> error. This is an account-level problem that needs fixing — a fallback provider may be handling traffic for now, but the primary provider's quota is still exhausted.</p>
    <ul>
      <li><strong>Provider:</strong> ${escapeHtml(event.provider)}</li>
      <li><strong>Kind:</strong> ${escapeHtml(event.error_kind ?? 'unknown')}</li>
      <li><strong>Task:</strong> ${escapeHtml(event.task)}</li>
      <li><strong>Tenant:</strong> ${escapeHtml(event.tenant_id ?? '(none)')}</li>
      <li><strong>Time:</strong> ${new Date().toISOString()}</li>
    </ul>
    <p>Action: top up provider credits or raise the project's monthly budget cap.</p>
    <p>Further alerts of this kind are debounced for ${debounceMinutes} minutes.</p>
  `;

  await sendEmail({
    to: recipient,
    subject,
    html,
    caslCategory: 'transactional',
    caslEvidence: {
      reason: 'ai_provider_alert',
      provider: event.provider,
      kind: event.error_kind,
      task: event.task,
    },
  });
}

async function maybeAlertCallFailed(event: RouterCallFailedEvent): Promise<void> {
  const recipient = process.env.AI_ALERT_EMAIL?.trim();
  if (!recipient) return;

  const debounceMinutes = parseDebounceMinutes();
  const claimed = await claimAlertSlot(event.provider, event.error_kind, debounceMinutes);
  if (!claimed) return;

  const subject = `[HeyHenry AI] all fallbacks failed — ${event.error_kind} on ${event.task}`;
  const actionByKind: Record<string, string> = {
    overload:
      'Provider-side outage — watch the status page. Consider shifting primary traffic to a fallback in routing.ts if it persists.',
    rate_limit: 'Climb the provider usage tier, or shift traffic to a fallback in routing.ts.',
    timeout: 'Check provider status and network connectivity. May resolve on its own.',
    unknown: 'Inspect logs for the underlying error. May need routing change.',
  };
  const action = actionByKind[event.error_kind] ?? 'Inspect logs for details.';

  const html = `
    <p>An AI call failed after exhausting all fallback providers. Users on this task are seeing errors.</p>
    <ul>
      <li><strong>Task:</strong> ${escapeHtml(event.task)}</li>
      <li><strong>Kind:</strong> ${escapeHtml(event.error_kind)}</li>
      <li><strong>Last provider tried:</strong> ${escapeHtml(event.provider)}</li>
      <li><strong>Providers attempted:</strong> ${event.attempts_made}</li>
      <li><strong>Tenant:</strong> ${escapeHtml(event.tenant_id ?? '(none)')}</li>
      <li><strong>Time:</strong> ${new Date().toISOString()}</li>
    </ul>
    <p>Action: ${escapeHtml(action)}</p>
    <p>Further alerts of this kind are debounced for ${debounceMinutes} minutes.</p>
  `;

  await sendEmail({
    to: recipient,
    subject,
    html,
    caslCategory: 'transactional',
    caslEvidence: {
      reason: 'ai_provider_alert',
      provider: event.provider,
      kind: event.error_kind,
      task: event.task,
    },
  });
}

/**
 * Atomically claim the alert slot for (provider, kind). Returns true iff
 * this caller is the one who got the slot — i.e. either the row didn't
 * exist, or the previous `last_sent_at` was older than the debounce
 * window. Implemented as a single round trip via INSERT...ON CONFLICT
 * with a WHERE-clause on the DO UPDATE, so concurrent attempts don't
 * double-fire.
 */
async function claimAlertSlot(
  provider: string,
  kind: string,
  debounceMinutes: number,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('ai_alerts_claim_slot', {
    p_provider: provider,
    p_kind: kind,
    p_debounce_minutes: debounceMinutes,
  });
  if (error) {
    // RPC not available or failed — fall back to a non-atomic check
    // rather than spamming. Read-then-write is good enough at our
    // current scale (single-digit alerts/hour worst case).
    return claimViaReadWrite(provider, kind, debounceMinutes);
  }
  return Boolean(data);
}

async function claimViaReadWrite(
  provider: string,
  kind: string,
  debounceMinutes: number,
): Promise<boolean> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - debounceMinutes * 60_000).toISOString();
  const { data: existing } = await admin
    .from('ai_alerts')
    .select('last_sent_at')
    .eq('provider', provider)
    .eq('kind', kind)
    .maybeSingle();
  if (existing?.last_sent_at && existing.last_sent_at > cutoff) return false;
  const { error: upsertErr } = await admin
    .from('ai_alerts')
    .upsert({ provider, kind, last_sent_at: new Date().toISOString() });
  return !upsertErr;
}

function parseDebounceMinutes(): number {
  const raw = process.env.AI_ALERT_DEBOUNCE_MINUTES;
  if (!raw) return DEFAULT_DEBOUNCE_MINUTES;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DEBOUNCE_MINUTES;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
