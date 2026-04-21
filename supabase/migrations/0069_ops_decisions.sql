-- 0069_ops_decisions.sql
-- Decisions module. Each decision is: hypothesis -> action -> outcome ->
-- learning. Status progresses open -> measuring -> learned (or reverted /
-- abandoned). Outcomes are append-only so a decision that's measured more
-- than once keeps the full trail.

CREATE TABLE IF NOT EXISTS ops.decisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('human', 'agent')),
  actor_name    TEXT NOT NULL,
  key_id        UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  hypothesis    TEXT NOT NULL,
  action        TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'measuring', 'learned', 'reverted', 'abandoned')),
  tags          TEXT[] NOT NULL DEFAULT '{}',
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_decisions_status_created_idx
  ON ops.decisions (status, created_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS ops.decision_outcomes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id   UUID NOT NULL REFERENCES ops.decisions(id) ON DELETE CASCADE,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name    TEXT NOT NULL,
  body          TEXT NOT NULL,
  metrics       JSONB NOT NULL DEFAULT '{}'::jsonb,
  concluded_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_decision_outcomes_decision_idx
  ON ops.decision_outcomes (decision_id, created_at);

CREATE TABLE IF NOT EXISTS ops.decision_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id   UUID NOT NULL REFERENCES ops.decisions(id) ON DELETE CASCADE,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name    TEXT NOT NULL,
  key_id        UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_decision_comments_decision_idx
  ON ops.decision_comments (decision_id, created_at);

ALTER TABLE ops.decisions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.decision_outcomes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.decision_comments  ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ops.decisions, ops.decision_outcomes, ops.decision_comments
  TO service_role;
