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
