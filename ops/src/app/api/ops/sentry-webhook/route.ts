/**
 * Sentry → ops incidents bridge.
 *
 * Sentry "Internal Integration" posts here on issue events. We verify the
 * `sentry-hook-signature` HMAC, map the issue into ops.incidents, and
 * upsert by sentry_issue_id so re-fires (alert spike, status change) just
 * bump event_count rather than spawning duplicate incidents.
 *
 * Auth: HMAC-SHA256 of the raw body using SENTRY_WEBHOOK_SECRET. Sentry
 * does NOT use our ops_* HMAC keys — this is a separate machine→machine
 * channel with its own secret.
 *
 * Configure on Sentry side: Settings → Developer Settings → Internal
 * Integrations → New → Webhook URL = https://ops.heyhenry.io/api/ops/sentry-webhook
 * Permissions: Issue & Event = Read. Subscribe to: issue. Copy the client
 * secret into Vercel as SENTRY_WEBHOOK_SECRET.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase';

type SentryLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

const SEVERITY_BY_LEVEL: Record<SentryLevel, 'critical' | 'high' | 'med' | 'low'> = {
  fatal: 'critical',
  error: 'high',
  warning: 'med',
  info: 'low',
  debug: 'low',
};

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('sentry-hook-signature');

  if (!verifySignature(rawBody, signature, env.sentryWebhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: SentryWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as SentryWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Sentry sends many resource types; we only care about `issue.*`.
  const resource = req.headers.get('sentry-hook-resource');
  if (resource !== 'issue' && resource !== 'event_alert') {
    return NextResponse.json({ ok: true, ignored: resource });
  }

  const issue = payload.data?.issue ?? payload.data?.event?.issue;
  if (!issue) {
    return NextResponse.json({ error: 'No issue in payload' }, { status: 400 });
  }

  const level = (issue.level ?? 'error') as SentryLevel;
  const severity = SEVERITY_BY_LEVEL[level] ?? 'high';
  const sentryIssueId = String(issue.id);
  const sentryUrl = issue.web_url ?? issue.permalink ?? '';
  const eventCount = Number(issue.count ?? 1);

  // Pull the most useful tags from the latest event when present.
  const tags = extractTags(payload);
  const transaction = tags.transaction ?? issue.culprit ?? 'unknown';
  const tenantId = tags.tenant_id ?? 'unknown';
  const tenantPlan = tags.tenant_plan ?? 'unknown';
  const userId = tags['user.id'] ?? tags.user_id ?? 'unknown';
  const errorBoundary = tags.error_boundary ?? null;
  const release = tags.release ?? null;

  const body = [
    `**Route:** ${transaction}`,
    `**Tenant:** ${tenantId} (${tenantPlan})`,
    `**User:** ${userId}`,
    errorBoundary ? `**Error boundary:** ${errorBoundary}` : null,
    release ? `**Release:** ${release}` : null,
    `**Event count:** ${eventCount}`,
    '',
    `[Open in Sentry](${sentryUrl})`,
  ]
    .filter(Boolean)
    .join('\n');

  const service = createServiceClient();

  // Upsert by sentry_issue_id — re-firing alerts on the same issue update
  // event_count + status timestamps without creating dup incidents.
  const { data, error } = await service
    .schema('ops')
    .from('incidents')
    .upsert(
      {
        actor_type: 'system',
        actor_name: 'sentry-webhook',
        source: 'sentry',
        severity,
        status: 'open',
        title: issue.title ?? 'Untitled Sentry issue',
        body,
        sentry_issue_id: sentryIssueId,
        sentry_issue_url: sentryUrl,
        event_count: eventCount,
        context: {
          level,
          transaction,
          tenant_id: tenantId,
          tenant_plan: tenantPlan,
          user_id: userId,
          error_boundary: errorBoundary,
          release,
          sentry_action: payload.action,
        },
      },
      { onConflict: 'sentry_issue_id' },
    )
    .select('id, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    incident_id: data.id,
    sentry_issue_id: sentryIssueId,
  });
}

// --- Sentry payload typing ------------------------------------------------
// Loose — Sentry's webhook payload varies by resource. We only read what we
// need; everything else passes through into context for later inspection.

type SentryIssue = {
  id: string | number;
  title?: string;
  culprit?: string;
  level?: string;
  web_url?: string;
  permalink?: string;
  count?: string | number;
  metadata?: Record<string, unknown>;
};

type SentryEvent = {
  issue?: SentryIssue;
  tags?: Array<[string, string]>;
};

type SentryWebhookPayload = {
  action?: string;
  data?: {
    issue?: SentryIssue;
    event?: SentryEvent;
  };
};

function extractTags(payload: SentryWebhookPayload): Record<string, string> {
  const eventTags = payload.data?.event?.tags;
  if (!Array.isArray(eventTags)) return {};
  const out: Record<string, string> = {};
  for (const entry of eventTags) {
    if (Array.isArray(entry) && entry.length === 2) {
      out[entry[0]] = entry[1];
    }
  }
  return out;
}
