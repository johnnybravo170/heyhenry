/**
 * Hygiene cron: cap the decision-bundle queue.
 *
 * Rule (per kanban card 875a562a):
 *   "Cap decision bundles at 5 open / 10 parked. When over cap, oldest open
 *    bundles past 7 days get force-resolved as `not_now` by the triage agent
 *    itself — no Jonathan touch. Parked-bundle cap fires by oldest-first.
 *    Resurface_trigger semantics preserved."
 *
 * Mechanically:
 *   - Open bundles (status='open'), oldest-first. If count > OPEN_CAP, take
 *     the overflow whose created_at is older than OPEN_AGE_DAYS and resolve
 *     them as status='resolved', choice='not_now'. Anything younger gets a
 *     pass — caps shouldn't punish recency.
 *   - Parked bundles (status='parked'), oldest-first. If count > PARKED_CAP,
 *     take the overflow and archive them (status='archived', choice='never').
 *     We preserve `resurface_trigger` on archive so the row stays auditable.
 *
 * Schedule: daily at 15:30 UTC — alongside ideas-stale, before ideas-digest.
 *
 * Why a Vercel cron, not "extend daily-board-triage": same reasoning as
 * ideas-stale — deterministic fan-out belongs in code, not an LLM prompt.
 *
 * Auth: Vercel x-vercel-cron-signature OR Authorization: Bearer ${CRON_SECRET}.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { finishAgentRun, recordAgentRun } from '@/lib/agents';
import { createServiceClient } from '@/lib/supabase';

export const maxDuration = 60;

const OPEN_CAP = 5;
const PARKED_CAP = 10;
const OPEN_AGE_DAYS = 7;

type BundleRow = {
  id: string;
  dedup_key: string;
  bucket: string;
  status: string;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const fromVercelCron = req.headers.get('x-vercel-cron-signature') !== null;
  if (!fromVercelCron) {
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const expected = process.env.CRON_SECRET;
    if (!expected || bearer !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const run = await recordAgentRun({
    slug: 'bundles-cap',
    trigger: fromVercelCron ? 'schedule' : 'manual',
  }).catch(() => null);

  try {
    const result = await runBundlesCap();
    const acted = result.open_resolved + result.parked_archived;
    if (run) {
      await finishAgentRun(run.id, {
        outcome: acted === 0 ? 'skipped' : 'success',
        items_scanned: result.open_count + result.parked_count,
        items_acted: acted,
        summary:
          acted === 0
            ? `Within caps (open=${result.open_count}/${OPEN_CAP}, parked=${result.parked_count}/${PARKED_CAP})`
            : `Open resolved=not_now: ${result.open_resolved}. Parked archived: ${result.parked_archived}. Pre-counts open=${result.open_count}, parked=${result.parked_count}.`,
        payload: result,
      }).catch(() => undefined);
    }
    return NextResponse.json(result);
  } catch (e) {
    if (run) {
      await finishAgentRun(run.id, {
        outcome: 'failure',
        error: e instanceof Error ? e.message : String(e),
      }).catch(() => undefined);
    }
    throw e;
  }
}

async function runBundlesCap(): Promise<{
  ok: true;
  open_count: number;
  parked_count: number;
  open_resolved: number;
  parked_archived: number;
  open_resolved_ids: string[];
  parked_archived_ids: string[];
}> {
  const service = createServiceClient();
  const now = new Date().toISOString();
  const openAgeCutoff = new Date(Date.now() - OPEN_AGE_DAYS * 86400_000).toISOString();

  // --- Open bundles --------------------------------------------------------
  const { data: openRows, error: openErr } = await service
    .schema('ops')
    .from('decision_bundles')
    .select('id, dedup_key, bucket, status, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  if (openErr) throw new Error(`open bundles query failed: ${openErr.message}`);

  const opens = (openRows ?? []) as BundleRow[];
  let openResolvedIds: string[] = [];
  if (opens.length > OPEN_CAP) {
    // Overflow oldest-first, only if older than the age floor — don't punish
    // a bundle that legitimately landed in the last 7 days just because the
    // queue happens to be deep.
    const overflow = opens.slice(0, opens.length - OPEN_CAP);
    openResolvedIds = overflow.filter((r) => r.created_at < openAgeCutoff).map((r) => r.id);
    if (openResolvedIds.length > 0) {
      const { error: updErr } = await service
        .schema('ops')
        .from('decision_bundles')
        .update({
          status: 'resolved',
          choice: 'not_now',
          updated_at: now,
        })
        .in('id', openResolvedIds);
      if (updErr) throw new Error(`open bundle resolve failed: ${updErr.message}`);
    }
  }

  // --- Parked bundles ------------------------------------------------------
  const { data: parkedRows, error: parkedErr } = await service
    .schema('ops')
    .from('decision_bundles')
    .select('id, dedup_key, bucket, status, created_at')
    .eq('status', 'parked')
    .order('created_at', { ascending: true });
  if (parkedErr) throw new Error(`parked bundles query failed: ${parkedErr.message}`);

  const parked = (parkedRows ?? []) as BundleRow[];
  let parkedArchivedIds: string[] = [];
  if (parked.length > PARKED_CAP) {
    parkedArchivedIds = parked.slice(0, parked.length - PARKED_CAP).map((r) => r.id);
    const { error: updErr } = await service
      .schema('ops')
      .from('decision_bundles')
      .update({
        status: 'archived',
        choice: 'never',
        updated_at: now,
      })
      .in('id', parkedArchivedIds);
    if (updErr) throw new Error(`parked bundle archive failed: ${updErr.message}`);
  }

  return {
    ok: true,
    open_count: opens.length,
    parked_count: parked.length,
    open_resolved: openResolvedIds.length,
    parked_archived: parkedArchivedIds.length,
    open_resolved_ids: openResolvedIds,
    parked_archived_ids: parkedArchivedIds,
  };
}
