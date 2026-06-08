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

/** Project IDs nudged with `kind` within the dedupe window, batched. */
async function recentlyNudgedSet(
  admin: ReturnType<typeof createAdminClient>,
  projectIds: string[],
  kind: string,
): Promise<Set<string>> {
  if (projectIds.length === 0) return new Set();
  const cutoff = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from('project_events')
    .select('project_id')
    .in('project_id', projectIds)
    .eq('kind', kind)
    .gte('occurred_at', cutoff);
  return new Set((data ?? []).map((r) => r.project_id as string));
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

  const pendingRows = (pendingProjects ?? []) as Array<{
    id: string;
    tenant_id: string;
    name: string;
  }>;
  const pendingIds = pendingRows.map((p) => p.id);

  // Batch the per-project view + dedupe lookups (was 2 queries/project).
  const [viewedRes, notOpenedNudged] = await Promise.all([
    pendingIds.length > 0
      ? admin
          .from('public_page_views')
          .select('resource_id')
          .eq('resource_type', 'estimate')
          .in('resource_id', pendingIds)
      : Promise.resolve({ data: [] as { resource_id: string }[] }),
    recentlyNudgedSet(admin, pendingIds, 'estimate_not_opened_nudge'),
  ]);
  const viewedEstimateIds = new Set((viewedRes.data ?? []).map((r) => r.resource_id as string));

  let notOpened = 0;
  for (const row of pendingRows) {
    if (viewedEstimateIds.has(row.id)) continue;
    if (notOpenedNudged.has(row.id)) continue;

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

  const sentRows = (sentProjects ?? []) as Array<{
    id: string;
    tenant_id: string;
    name: string;
  }>;
  const sentIds = sentRows.map((p) => p.id);

  // Batch all estimate views for the candidate projects (was 1 query/project),
  // ordered newest-first so per-project grouping preserves that order.
  const [sentViewsRes, reopenNudged] = await Promise.all([
    sentIds.length > 0
      ? admin
          .from('public_page_views')
          .select('resource_id, viewed_at')
          .eq('resource_type', 'estimate')
          .in('resource_id', sentIds)
          .order('viewed_at', { ascending: false })
      : Promise.resolve({ data: [] as { resource_id: string; viewed_at: string }[] }),
    recentlyNudgedSet(admin, sentIds, 'estimate_reopened_after_silence'),
  ]);
  const viewedAtByProject = new Map<string, string[]>();
  for (const r of sentViewsRes.data ?? []) {
    const pid = r.resource_id as string;
    const arr = viewedAtByProject.get(pid) ?? [];
    arr.push(r.viewed_at as string);
    viewedAtByProject.set(pid, arr);
  }

  let reopened = 0;
  for (const row of sentRows) {
    const v = viewedAtByProject.get(row.id) ?? [];
    if (v.length < 2) continue;
    const latest = new Date(v[0]);
    const prior = new Date(v[1]);
    const gapMs = latest.getTime() - prior.getTime();
    if (gapMs < REOPEN_SILENCE_DAYS * 24 * 60 * 60 * 1000) continue;
    if (new Date(v[0]) <= new Date(silenceCutoff)) continue;
    if (reopenNudged.has(row.id)) continue;

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
