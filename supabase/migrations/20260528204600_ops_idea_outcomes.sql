-- 20260528204600_ops_idea_outcomes.sql
-- Phase 0 for the producer-learner loop: the idea outcome log.
--
-- WHY THIS EXISTS
-- Learning agents (scout-learner first) need a clean, per-scout training signal:
-- what happened to each idea this scout filed, and WHEN. Today that signal is
-- scattered across ops.ideas columns (user_rating / archived_at) + a
-- `promoted:<card_id>` tag, with two problems the learner can't work around:
--   1. No chronological HISTORY. user_rating is a single overwriteable column;
--      a re-rate destroys the prior signal and "acted within 48h of filing"
--      cannot be reconstructed.
--   2. No reason for archival. archived_at alone cannot distinguish an idea that
--      AGED OUT (nobody looked — a WEAK negative) from one Jonathan DELIBERATELY
--      killed (a STRONG negative). getScoutReportCard currently lumps both into
--      one "implicit -1", which would teach the learner the wrong lesson
--      (chase recency) if it trained on the dominant aged-out bucket.
--
-- This append-only event log fixes both. It mirrors the ops.kanban_card_events
-- pattern (events written by app code after each mutation, not by DB triggers).
-- Idea state columns (status / user_rating / archived_at) stay as current-state
-- convenience; the HISTORY lives here.
--
-- Signal strength the scout-learner must respect (encoded in event_type):
--   promoted_to_card .......... strongest positive
--   rated_up (user_rating > 0)  strong positive
--   archived_explicit / rated_down ... strong negative
--   parked .................... neutral / contextual
--   archived_stale ............ WEAK negative (aged out) — discount heavily
--
-- The hygiene card (875a562a) wires the auto-archive cron to emit
-- `archived_stale`; a human archive emits `archived_explicit`. That single
-- distinction is the whole point of this table.

CREATE TABLE IF NOT EXISTS ops.idea_outcomes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id       UUID NOT NULL REFERENCES ops.ideas(id) ON DELETE CASCADE,
  -- Denormalized from ops.ideas.actor_name at insert so the learner can group
  -- by scout without a join (and so the signal survives if the idea is later
  -- hard-deleted in some future cleanup — though ON DELETE CASCADE means the
  -- normal path removes outcomes with their idea).
  scout_slug    TEXT NOT NULL,
  event_type    TEXT NOT NULL
                CHECK (event_type IN (
                  'promoted_to_card',
                  'rated_up',
                  'rated_down',
                  'archived_explicit',
                  'archived_stale',
                  'parked'
                )),
  -- Set when event_type = 'promoted_to_card' (kanban card or roadmap item id).
  card_id       UUID,
  -- The signed -2/-1/+1/+2 value when event_type is rated_up / rated_down, so
  -- the learner can weight a -2 ("never again") harder than a -1 ("low signal").
  rating        SMALLINT CHECK (rating IS NULL OR rating IN (-2, -1, 1, 2)),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name    TEXT NOT NULL,
  key_id        UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary learner read: "all outcomes for scout X in the last N days".
CREATE INDEX IF NOT EXISTS ops_idea_outcomes_scout_idx
  ON ops.idea_outcomes (scout_slug, created_at DESC);
-- Per-idea timeline (idea detail page, "acted within 48h" reconstruction).
CREATE INDEX IF NOT EXISTS ops_idea_outcomes_idea_idx
  ON ops.idea_outcomes (idea_id, created_at);

ALTER TABLE ops.idea_outcomes ENABLE ROW LEVEL SECURITY;

-- No authenticated policies. Service role bypasses RLS, same model as ops.ideas (0065).
GRANT SELECT, INSERT, UPDATE, DELETE ON ops.idea_outcomes TO service_role;

-- ---------------------------------------------------------------------------
-- BACKFILL — seed one event per derivable past outcome so the learner's first
-- run has history. Best-effort: timestamps are exact where we have them
-- (user_rated_at, archived_at) and approximate (updated_at) where we don't.
-- Conservative on archives: every existing archive is backfilled as
-- `archived_stale` (WEAK), never `archived_explicit` — we have no historical
-- record proving any archive was a deliberate kill, and manufacturing a strong
-- negative signal we can't prove would poison the learner.
-- ---------------------------------------------------------------------------

-- Explicit ratings (the latest one per idea is all that survives in the column).
INSERT INTO ops.idea_outcomes
  (idea_id, scout_slug, event_type, rating, actor_type, actor_name, admin_user_id, created_at, metadata)
SELECT
  i.id,
  i.actor_name,
  CASE WHEN i.user_rating > 0 THEN 'rated_up' ELSE 'rated_down' END,
  i.user_rating,
  'human',
  COALESCE(i.user_rated_by::text, 'jonathan'),
  i.user_rated_by,
  COALESCE(i.user_rated_at, i.updated_at),
  jsonb_build_object('backfill', true, 'reason', i.user_rating_reason)
FROM ops.ideas i
WHERE i.user_rating IS NOT NULL;

-- Promotions: any idea carrying a `promoted:<card_id>` tag.
INSERT INTO ops.idea_outcomes
  (idea_id, scout_slug, event_type, card_id, actor_type, actor_name, created_at, metadata)
SELECT
  i.id,
  i.actor_name,
  'promoted_to_card',
  NULLIF(substring(t FROM '^promoted:(.+)$'), '')::uuid,
  'system',
  'ops',
  i.updated_at,
  jsonb_build_object('backfill', true, 'source_tag', t)
FROM ops.ideas i
CROSS JOIN LATERAL unnest(i.tags) AS t
WHERE t LIKE 'promoted:%'
  AND substring(t FROM '^promoted:(.+)$') ~ '^[0-9a-fA-F-]{36}$';

-- Archives: conservatively all backfilled as aged-out (weak negative).
INSERT INTO ops.idea_outcomes
  (idea_id, scout_slug, event_type, actor_type, actor_name, created_at, metadata)
SELECT
  i.id,
  i.actor_name,
  'archived_stale',
  'system',
  'ops',
  i.archived_at,
  jsonb_build_object('backfill', true, 'note', 'archive reason unknown at backfill; conservatively weak')
FROM ops.ideas i
WHERE i.archived_at IS NOT NULL;
