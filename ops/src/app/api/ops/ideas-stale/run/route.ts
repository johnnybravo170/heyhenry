/**
 * Hygiene cron: auto-archive stale scout-filed ideas.
 *
 * Rule (per kanban card 875a562a):
 *   "Auto-archive scout-filed ideas >14 days old with no rating."
 *
 * Concretely: any agent-filed idea older than 14 days that
 *   - is not already archived
 *   - has no explicit user_rating (-2 / -1 / +1 / +2)
 *   - has no legacy `rating` (1–5)
 *   - is not in_progress
 *   - was not promoted to a card (no `promoted:<id>` tag)
 * gets archived_at = now() AND an `archived_stale` outcome event so the
 * scout-learner can distinguish it from an explicit human kill
 * (archived_explicit). That distinction is the whole point of the outcome
 * log (Phase 0 — see migration 20260528204600_ops_idea_outcomes.sql + the
 * Phase-0 doc in the Ops vault).
 *
 * Schedule: daily at 15:00 UTC — BEFORE ideas-digest (16:00) so stale ideas
 * don't show up in the digest the day they're archived.
 *
 * Why a Vercel cron and not "extend daily-board-triage":
 *   Deterministic fan-out (filter → mutate) belongs in code, not an LLM
 *   prompt — that's the routines-vs-cron rule of thumb in the ROUTINES
 *   module doc. Code-level enforcement is more reliable, doesn't burn the
 *   Remote-routine 15/day cap, and produces a clean agent_runs row.
 *
 * Auth: Vercel x-vercel-cron-signature OR Authorization: Bearer ${CRON_SECRET}.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { finishAgentRun, recordAgentRun } from '@/lib/agents';
import { createServiceClient } from '@/lib/supabase';
import { logIdeaOutcome } from '@/server/ops-services/ideas';

export const maxDuration = 60;

const STALE_DAYS = 14;
// Hard cap on per-run work so a one-time clear of a giant backlog can't
// blow the function timeout or produce a 5000-row payload. Anything beyond
// this just rolls into the next run.
const MAX_PER_RUN = 200;

type StaleIdea = {
  id: string;
  actor_name: string;
  title: string;
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
    slug: 'ideas-stale',
    trigger: fromVercelCron ? 'schedule' : 'manual',
  }).catch(() => null);

  try {
    const result = await runIdeasStale();
    if (run) {
      const sampleTitles = result.archived_titles.slice(0, 5);
      await finishAgentRun(run.id, {
        outcome: result.archived === 0 ? 'skipped' : 'success',
        items_scanned: result.scanned,
        items_acted: result.archived,
        summary:
          result.archived === 0
            ? `No stale ideas to archive (scanned ${result.scanned})`
            : `Archived ${result.archived} stale idea${result.archived === 1 ? '' : 's'} (>${STALE_DAYS}d, unrated). Sample: ${sampleTitles.join(' · ')}`,
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

async function runIdeasStale(): Promise<{
  ok: true;
  scanned: number;
  archived: number;
  archived_ids: string[];
  archived_titles: string[];
}> {
  const service = createServiceClient();
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString();
  const now = new Date().toISOString();

  // Pull candidates. The `promoted:` filter is applied in JS because PostgREST
  // doesn't have a clean "tags does NOT contain any element matching a prefix"
  // operator; the row count is small (capped at MAX_PER_RUN) so a JS filter is fine.
  const { data: candidates, error } = await service
    .schema('ops')
    .from('ideas')
    .select('id, actor_name, title, status, tags, user_rating, rating')
    .eq('actor_type', 'agent')
    .is('archived_at', null)
    .is('user_rating', null)
    .is('rating', null)
    .neq('status', 'in_progress')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN);
  if (error) throw new Error(`stale-ideas query failed: ${error.message}`);

  const rows = (candidates ?? []) as Array<{
    id: string;
    actor_name: string;
    title: string;
    status: string;
    tags: string[] | null;
  }>;

  // A promoted idea is one with any `promoted:<card_id>` tag — by definition acted
  // on, even if not rated. Exclude from auto-archive.
  const toArchive: StaleIdea[] = rows
    .filter((r) => !(r.tags ?? []).some((t) => t.startsWith('promoted:')))
    .map((r) => ({ id: r.id, actor_name: r.actor_name, title: r.title }));

  if (toArchive.length === 0) {
    return {
      ok: true,
      scanned: rows.length,
      archived: 0,
      archived_ids: [],
      archived_titles: [],
    };
  }

  // Single bulk archive. archived_at IS NULL precondition is already in the query;
  // a concurrent human archive would only collide on a row we'd archive anyway.
  const ids = toArchive.map((r) => r.id);
  const { error: updErr } = await service
    .schema('ops')
    .from('ideas')
    .update({ archived_at: now, updated_at: now })
    .in('id', ids);
  if (updErr) throw new Error(`bulk archive failed: ${updErr.message}`);

  // Outcome events — best-effort per row, swallowed by logIdeaOutcome on failure
  // so a telemetry blip can't undo an archive. Sequential is fine: tens of rows,
  // not thousands, and an array bulk insert would lose the per-row scout_slug
  // mapping we need for the learner.
  for (const r of toArchive) {
    await logIdeaOutcome(
      r.id,
      r.actor_name,
      'archived_stale',
      { actorType: 'system', actorName: 'ideas-stale-cron' },
      { metadata: { stale_days: STALE_DAYS, via: 'auto_archive_cron' } },
    );
  }

  return {
    ok: true,
    scanned: rows.length,
    archived: toArchive.length,
    archived_ids: ids,
    archived_titles: toArchive.map((r) => r.title),
  };
}
