-- 20260525221714_ops_decision_bundles.sql
-- Command Center queue backing store + agent registration.
--
-- The "daily-board-triage" Routine (HeyHenry Command Center) scans the
-- kanban board + the scout ideas pool every weekday and drafts ONE item
-- per thing-that-needs-judgment into this table. Each row is its best
-- thinking (recommendation + why-now + options), surfaced at /admin/queue,
-- where Jonathan resolves it in ~ten minutes. READ + DRAFT only on the
-- agent side; the human makes the call.
--
-- Five queue streams map to four buckets here (the fifth, "Shipping to PR",
-- is the ready arm's auto-shipped PRs — tracked elsewhere, not a bundle):
--   decision  -> "Decisions for you"
--   research  -> "Research decisions" (triaged scout signal)
--   go_nogo   -> "Go / no-go" (ready-but-bigger work)
--   grooming  -> "Grooming / Parked" (underspecified or good-but-not-now)
--
-- ops.* convention: service-role only, RLS enabled with no policies. The
-- /admin/queue page reads via the service client behind requireAdmin().

CREATE TABLE IF NOT EXISTS ops.decision_bundles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Audit / attribution (the Routine writes as actor_type='agent').
  actor_type        TEXT NOT NULL CHECK (actor_type IN ('human', 'agent')),
  actor_name        TEXT NOT NULL,
  key_id            UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Idempotency handle the agent controls (e.g. 'card:<uuid>',
  -- 'idea:<uuid>', or 'theme:<slug>' for cross-scout merges). One open
  -- bundle per key — re-runs upsert instead of duplicating.
  dedup_key         TEXT NOT NULL UNIQUE,

  -- Source pointer. card_id references either a kanban card or an idea;
  -- related_type disambiguates so resolve/resurface acts on the right row.
  card_id           UUID,
  related_type      TEXT CHECK (related_type IN ('kanban', 'idea')),

  bucket            TEXT NOT NULL
                      CHECK (bucket IN ('decision', 'research', 'go_nogo', 'grooming')),

  -- The call being put to Jonathan, plus the agent's grounded thinking.
  question          TEXT NOT NULL,
  -- For decision/go_nogo: array of { key, label, blast_radius?, unblocks? }.
  -- Null for research/grooming (those use the do-it / not-now / never verbs).
  options           JSONB,
  recommendation    TEXT,
  why_today         TEXT,
  links             JSONB,

  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'resolved', 'parked', 'archived')),
  -- Set when status='parked' (a timing call, not a delete). The agent
  -- resurfaces the row when the now-context stage advances. e.g.
  -- 'resurface:v1', 'resurface:growth'.
  resurface_trigger TEXT,

  -- The human's resolution. choice holds an option key (decision/go_nogo)
  -- or a verb ('do_it' | 'not_now' | 'never') for research/grooming.
  choice            TEXT,
  -- Report-card signal: how good was the recommendation (1-5). Calibrates
  -- which streams / scouts earn their keep.
  rating            SMALLINT CHECK (rating BETWEEN 1 AND 5),
  -- Decision logged on resolution (decisions_add linkage).
  decision_id       UUID REFERENCES ops.decisions(id) ON DELETE SET NULL,
  resolution_note   TEXT,

  surfaced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The queue page reads open bundles grouped by bucket, newest first.
CREATE INDEX IF NOT EXISTS ops_decision_bundles_open_idx
  ON ops.decision_bundles (bucket, surfaced_at DESC)
  WHERE status = 'open';

-- Resurface scan reads parked bundles by trigger.
CREATE INDEX IF NOT EXISTS ops_decision_bundles_parked_idx
  ON ops.decision_bundles (resurface_trigger)
  WHERE status = 'parked';

ALTER TABLE ops.decision_bundles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON ops.decision_bundles TO service_role;

CREATE OR REPLACE FUNCTION ops.decision_bundles_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS decision_bundles_touch ON ops.decision_bundles;
CREATE TRIGGER decision_bundles_touch
  BEFORE UPDATE ON ops.decision_bundles
  FOR EACH ROW EXECUTE FUNCTION ops.decision_bundles_touch_updated_at();

COMMENT ON TABLE ops.decision_bundles IS
  'Command Center queue: one drafted decision/research/go-no-go/grooming item per thing needing judgment. Agent drafts (read+draft only); human resolves at /admin/queue.';
COMMENT ON COLUMN ops.decision_bundles.dedup_key IS
  'Agent-controlled idempotency handle (card:<uuid> | idea:<uuid> | theme:<slug>). One bundle per key.';
COMMENT ON COLUMN ops.decision_bundles.resurface_trigger IS
  'For parked bundles: the now-context stage that should wake this back into triage (resurface:v1, resurface:growth, …).';

-- ============================================================
-- Register the Command Center routine in the agents registry.
-- DB-backed registry (per 0203) — registration is an idempotent INSERT.
-- ============================================================
INSERT INTO ops.agents (slug, name, description, agent_type, schedule, owner, status, expected_max_gap_minutes, tags)
VALUES (
  'daily-board-triage',
  'HeyHenry Command Center',
  'Weekday morning triage. Scans the kanban board + scout ideas pool, routes each item to one of five streams (Decisions · Research · Shipping to PR · Go/no-go · Grooming/Parked), drafts grounded recommendations into ops.decision_bundles, and sends ONE digest email linking to /admin/queue. Source: ROUTINES/daily-board-triage.md.',
  'routine',
  'Weekdays (Mon–Fri) ~7am America/Vancouver',
  'jonathan',
  'active',
  4320,
  ARRAY['command-center', 'triage', 'agent-pipelines']
)
ON CONFLICT (slug) DO UPDATE SET
  name                     = EXCLUDED.name,
  description              = EXCLUDED.description,
  agent_type               = EXCLUDED.agent_type,
  schedule                 = EXCLUDED.schedule,
  owner                    = EXCLUDED.owner,
  status                   = EXCLUDED.status,
  expected_max_gap_minutes = EXCLUDED.expected_max_gap_minutes,
  tags                     = EXCLUDED.tags,
  updated_at               = now();

-- Retire the weekly-dispatcher: its narrative roll-up folds into the
-- Command Center's daily digest (see ROUTINES/weekly-dispatcher.md, retired
-- 2026-05-25). No-op if the row was never registered.
UPDATE ops.agents
   SET status = 'archived', updated_at = now()
 WHERE slug = 'weekly-dispatcher' AND status <> 'archived';
