import { createServiceClient } from '@/lib/supabase';

export type ScoutReportCardIdea = {
  id: string;
  title: string;
  tags: string[];
  status: string;
  user_rating: number | null;
  user_rating_reason: string | null;
  user_rated_at: string | null;
  archived_at: string | null;
  created_at: string;
};

export type ScoutReportCard = {
  scoutTag: string;
  windowDays: number;
  rated: ScoutReportCardIdea[];
  promoted: ScoutReportCardIdea[];
  archivedWithoutPromotion: ScoutReportCardIdea[];
};

/**
 * Combined "report card" for a scout-style agent. Pulls the agent's recent
 * output and surfaces explicit + implicit human feedback signals so the agent
 * can adjust before producing new ideas.
 *
 * - rated: ideas with an explicit user_rating (window: user_rated_at)
 * - promoted: status='in_progress' AND a `promoted:<card_id>` tag (implicit +2)
 * - archivedWithoutPromotion: archived_at set with no promoted: tag (implicit -1)
 */
export async function getScoutReportCard(scoutTag: string, days = 30): Promise<ScoutReportCard> {
  const service = createServiceClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const cols =
    'id, title, tags, status, user_rating, user_rating_reason, user_rated_at, archived_at, created_at';

  const [ratedRes, promotedRes, archivedRes] = await Promise.all([
    service
      .schema('ops')
      .from('ideas')
      .select(cols)
      .contains('tags', [scoutTag])
      .not('user_rating', 'is', null)
      .gte('user_rated_at', since)
      .order('user_rated_at', { ascending: false })
      .limit(50),
    service
      .schema('ops')
      .from('ideas')
      .select(cols)
      .contains('tags', [scoutTag])
      .eq('status', 'in_progress')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
    service
      .schema('ops')
      .from('ideas')
      .select(cols)
      .contains('tags', [scoutTag])
      .not('archived_at', 'is', null)
      .gte('archived_at', since)
      .order('archived_at', { ascending: false })
      .limit(50),
  ]);

  if (ratedRes.error) throw new Error(ratedRes.error.message);
  if (promotedRes.error) throw new Error(promotedRes.error.message);
  if (archivedRes.error) throw new Error(archivedRes.error.message);

  const promoted = (promotedRes.data ?? []).filter((r) =>
    ((r.tags as string[] | null) ?? []).some((t) => t.startsWith('promoted:')),
  ) as ScoutReportCardIdea[];

  const archivedWithoutPromotion = (archivedRes.data ?? []).filter(
    (r) => !((r.tags as string[] | null) ?? []).some((t) => t.startsWith('promoted:')),
  ) as ScoutReportCardIdea[];

  return {
    scoutTag,
    windowDays: days,
    rated: (ratedRes.data ?? []) as ScoutReportCardIdea[],
    promoted,
    archivedWithoutPromotion,
  };
}

// ---------------------------------------------------------------------------
// Idea outcome log (ops.idea_outcomes) — the producer-learner training signal.
//
// Append-only history of what happened to each idea, mirroring the kanban
// logEvent pattern (written by app code after a mutation, not a DB trigger).
// The whole point vs. the existing scattered signals (user_rating column,
// archived_at, promoted: tag) is (a) a chronological history that survives
// re-rating and (b) the stale-vs-deliberate archive distinction the report
// card can't make. See migration 20260528204600_ops_idea_outcomes.sql.
// ---------------------------------------------------------------------------

export type IdeaOutcomeEvent =
  | 'promoted_to_card'
  | 'rated_up'
  | 'rated_down'
  | 'archived_explicit'
  | 'archived_stale'
  | 'parked';

export type IdeaOutcomeActor = {
  actorType: 'human' | 'agent' | 'system';
  actorName: string;
  keyId?: string | null;
  adminUserId?: string | null;
};

/**
 * Append one outcome event for an idea.
 *
 * `scoutSlug` is the producing scout's identity — pass the idea's `actor_name`
 * (e.g. 'business-scout'), NOT the scout TAG getScoutReportCard groups by
 * ('biz-scout'). The learner + ops.scout_policy standardize on actor_name.
 *
 * Best-effort: outcome telemetry must NEVER break the underlying user action
 * (a failed promote/rate because the log insert failed would be absurd), so a
 * failure is logged and swallowed — same "instrumentation is not a hard
 * dependency" rule the routines follow.
 */
export async function logIdeaOutcome(
  ideaId: string,
  scoutSlug: string,
  eventType: IdeaOutcomeEvent,
  actor: IdeaOutcomeActor,
  opts: { cardId?: string | null; rating?: number | null; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const service = createServiceClient();
    const { error } = await service
      .schema('ops')
      .from('idea_outcomes')
      .insert({
        idea_id: ideaId,
        scout_slug: scoutSlug,
        event_type: eventType,
        card_id: opts.cardId ?? null,
        rating: opts.rating ?? null,
        metadata: opts.metadata ?? {},
        actor_type: actor.actorType,
        actor_name: actor.actorName,
        key_id: actor.keyId ?? null,
        admin_user_id: actor.adminUserId ?? null,
      });
    if (error) {
      console.error(`[idea_outcomes] failed to log ${eventType} for ${ideaId}: ${error.message}`);
    }
  } catch (e) {
    console.error(`[idea_outcomes] threw logging ${eventType} for ${ideaId}:`, e);
  }
}
