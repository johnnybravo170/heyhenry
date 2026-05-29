-- 20260529040000_ops_scout_policy.sql
-- Producer-learner Phase 0 — the policy substrate.
--
-- The mutable rulebook the scout-learner edits and each scout reads at
-- run-start. Versioned + status-gated so the auto-rollback requirement
-- ("if accept rate drops below 20% for 2 consecutive weeks, revert the
-- offending rules") is a trivial `active` flip, not a git-revert across
-- a cloud-routine paste-back. See producer-learner Phase 0 doc + card
-- 0f6a9d4a.
--
-- Identity: `scout_slug` matches `ops.ideas.actor_name` (e.g. 'business-scout').
-- Standardize on actor_name — NOT the legacy tag identifier
-- `getScoutReportCard` filters on. PR #413's prompt patches make the
-- scouts pass their slug on every ideas_add; this table is keyed on the
-- same identifier so the learner's edits flow back to the right producer.
--
-- Why a table not a per-scout config file:
--   1. Auto-rollback is a row update, not a revert + redeploy + paste.
--   2. Version history is queryable for audit ("which rule caused the drop?").
--   3. No cloud↔repo drift — the cloud routine reads the same row at
--      run-start that the learner just wrote.

CREATE TABLE IF NOT EXISTS ops.scout_policy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_slug      TEXT NOT NULL,
  version         INT  NOT NULL,
  status          TEXT NOT NULL
                  CHECK (status IN ('proposed', 'active', 'superseded', 'rejected')),

  -- The actual policy. JSONB so the shape can evolve without DDL —
  -- start small (e.g. { "dont_file_categories": [...], "prioritize": [...],
  -- "dedup_rules": [...] }), grow as the learner finds patterns worth
  -- encoding.
  policy          JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Provenance: who proposed this version. 'scout-learner-v1' for the
  -- learner, 'jonathan' for hand-written baselines, etc.
  proposed_by     TEXT NOT NULL,

  -- Why this version was proposed — the learner's 3-line rationale +
  -- example idea ids that motivated each rule. The scout-learner card
  -- requires "each proposed rule includes the 3 example ideas that
  -- motivated it (auditable)" — that lives here.
  rationale       TEXT,

  -- Activation tracking. Only set when status flips to 'active' / 'superseded'.
  activated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_at    TIMESTAMPTZ,
  superseded_at   TIMESTAMPTZ,

  -- Standard actor cols, mirrors ops.ideas / ops.idea_outcomes.
  actor_type      TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name      TEXT NOT NULL,
  key_id          UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One version number per scout. Insert always picks max(version)+1.
  UNIQUE (scout_slug, version)
);

-- Exactly one active version per scout at any time. The activation
-- procedure: insert new row with status='active', flip the previous
-- active row to 'superseded' in the same transaction. The partial
-- unique index makes a forgotten supersede impossible — a second
-- 'active' insert for the same scout will fail loudly rather than
-- leave the system in a "two active policies" state the read side
-- can't reason about.
CREATE UNIQUE INDEX IF NOT EXISTS ops_scout_policy_one_active_per_slug
  ON ops.scout_policy (scout_slug) WHERE status = 'active';

-- Primary scout read: "what's my active policy?" — should hit the
-- partial active index, but a covering index keeps it cheap if the
-- query planner picks differently.
CREATE INDEX IF NOT EXISTS ops_scout_policy_active_idx
  ON ops.scout_policy (scout_slug) WHERE status = 'active';

-- Per-scout history / audit page.
CREATE INDEX IF NOT EXISTS ops_scout_policy_history_idx
  ON ops.scout_policy (scout_slug, version DESC);

-- "What's in my review queue?" — proposed versions oldest-first, so
-- the admin UI (future) drains them in proposal order.
CREATE INDEX IF NOT EXISTS ops_scout_policy_proposed_idx
  ON ops.scout_policy (created_at) WHERE status = 'proposed';

ALTER TABLE ops.scout_policy ENABLE ROW LEVEL SECURITY;

-- No authenticated policies. Service role bypasses RLS, same model as
-- ops.ideas (0065) and ops.idea_outcomes (20260528204600).
GRANT SELECT, INSERT, UPDATE, DELETE ON ops.scout_policy TO service_role;
