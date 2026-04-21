-- 0065_ops_ideas.sql
-- Phase 1 (ideas module). Adds ops.ideas + ops.idea_comments + ops.idea_followups.
--
-- The followups table is a queue of actions requested from the ideas detail
-- page. When the roadmap / assignment / notification subsystems land later,
-- they pick rows off this queue (setting resolved_at). For now the queue
-- fills up and the UI shows pending items so nothing gets lost.

CREATE TABLE IF NOT EXISTS ops.ideas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('human', 'agent')),
  actor_name    TEXT NOT NULL,
  key_id        UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'reviewed', 'in_progress', 'done', 'rejected')),
  rating        INT CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  assignee      TEXT,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_ideas_status_created_idx
  ON ops.ideas (status, created_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS ops_ideas_created_idx
  ON ops.ideas (created_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS ops.idea_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id       UUID NOT NULL REFERENCES ops.ideas(id) ON DELETE CASCADE,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name    TEXT NOT NULL,
  key_id        UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_idea_comments_idea_idx
  ON ops.idea_comments (idea_id, created_at);

CREATE TABLE IF NOT EXISTS ops.idea_followups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id           UUID NOT NULL REFERENCES ops.ideas(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL
                    CHECK (kind IN ('promote_to_roadmap', 'assign', 'generic_followup')),
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,
  resolved_by_system TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_idea_followups_pending_idx
  ON ops.idea_followups (kind, created_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS ops_idea_followups_idea_idx
  ON ops.idea_followups (idea_id, created_at);

ALTER TABLE ops.ideas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.idea_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.idea_followups   ENABLE ROW LEVEL SECURITY;

-- No authenticated policies. Service role bypasses RLS, same model as 0064.

GRANT SELECT, INSERT, UPDATE, DELETE ON ops.ideas, ops.idea_comments, ops.idea_followups
  TO service_role;
