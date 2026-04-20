/**
 * GET /api/projects/estimate-nudge
 *
 * Cron tick: surface two situations for pending/approved estimates:
 *   1. not-opened — sent > 24h ago, zero customer views
 *   2. re-opened — customer viewed again > 14d after last view
 *
 * Both emit a project_events row (feeds the project timeline) and a
 * worklog_entries row (Henry-visible follow-up prompt). Idempotent per
 * project per kind per 12h.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NOT_OPENED_AFTER_HOURS = 24;
const REOPEN_SILENCE_DAYS = 14;
const DEDUPE_HOURS = 12;

async function recentlyNudged(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  kind: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from('project_events')
    .select('id')
    .eq('project_id', projectId)
    .eq('kind', kind)
    .gte('occurred_at', cutoff)
    .limit(1);
  return (data ?? []).length > 0;
}

async function emitNudge(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    tenant_id: string;
    project_id: string;
    kind: string;
    title: string;
    body: string;
    meta?: Record<string, unknown>;
  },
) {
  await admin.from('project_events').insert({
    tenant_id: params.tenant_id,
    project_id: params.project_id,
    kind: params.kind,
    meta: params.meta ?? {},
    actor: 'system',
  });
  await admin.from('worklog_entries').insert({
    tenant_id: params.tenant_id,
    entry_type: 'system',
    title: params.title,
    body: params.body,
    related_type: 'project',
    related_id: params.project_id,
  });
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const notOpenedCutoff = new Date(
    Date.now() - NOT_OPENED_AFTER_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: pendingProjects } = await admin
    .from('projects')
    .select('id, tenant_id, name, estimate_sent_at, estimate_status')
    .eq('estimate_status', 'pending_approval')
    .lt('estimate_sent_at', notOpenedCutoff)
    .is('deleted_at', null);

  let notOpened = 0;
  for (const row of (pendingProjects ?? []) as Array<{
    id: string;
    tenant_id: string;
    name: string;
  }>) {
    const { count } = await admin
      .from('public_page_views')
      .select('id', { count: 'exact', head: true })
      .eq('resource_type', 'estimate')
      .eq('resource_id', row.id);

    if ((count ?? 0) > 0) continue;
    if (await recentlyNudged(admin, row.id, 'estimate_not_opened_nudge')) continue;

    await emitNudge(admin, {
      tenant_id: row.tenant_id,
      project_id: row.id,
      kind: 'estimate_not_opened_nudge',
      title: 'Estimate not yet opened',
      body: `Customer hasn't opened the estimate for ${row.name} — consider a text follow-up.`,
    });
    notOpened += 1;
  }

  const silenceCutoff = new Date(
    Date.now() - REOPEN_SILENCE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: sentProjects } = await admin
    .from('projects')
    .select('id, tenant_id, name')
    .in('estimate_status', ['pending_approval', 'declined'])
    .is('deleted_at', null);

  let reopened = 0;
  for (const row of (sentProjects ?? []) as Array<{
    id: string;
    tenant_id: string;
    name: string;
  }>) {
    const { data: views } = await admin
      .from('public_page_views')
      .select('viewed_at')
      .eq('resource_type', 'estimate')
      .eq('resource_id', row.id)
      .order('viewed_at', { ascending: false })
      .limit(2);

    const v = (views ?? []) as { viewed_at: string }[];
    if (v.length < 2) continue;
    const latest = new Date(v[0].viewed_at);
    const prior = new Date(v[1].viewed_at);
    const gapMs = latest.getTime() - prior.getTime();
    if (gapMs < REOPEN_SILENCE_DAYS * 24 * 60 * 60 * 1000) continue;
    if (new Date(v[0].viewed_at) <= new Date(silenceCutoff)) continue;
    if (await recentlyNudged(admin, row.id, 'estimate_reopened_after_silence')) continue;

    await emitNudge(admin, {
      tenant_id: row.tenant_id,
      project_id: row.id,
      kind: 'estimate_reopened_after_silence',
      title: 'Quote back in play',
      body: `${row.name} — customer re-opened the estimate after ${Math.round(
        gapMs / (24 * 60 * 60 * 1000),
      )} days of silence. Good moment to follow up.`,
      meta: { gap_days: Math.round(gapMs / (24 * 60 * 60 * 1000)) },
    });
    reopened += 1;
  }

  return Response.json({ ok: true, not_opened: notOpened, reopened });
}
