-- 0084_ops_agent_platform.sql
-- Phase 0 of the agent platform. Five new ops modules so background agents
-- have somewhere to write what they learn:
--   * competitors      — competitive intel cards, upsert by name
--   * incidents        — internal helpdesk queue (errors, QA, security, pulse)
--   * social_drafts    — drafted social/blog content awaiting human approval
--   * docs             — generated documentation keyed by commit range
--   * (review_queue is read-only aggregator; no table)
--
-- All RLS-enabled with no policies — service-role-only access via /api/ops/*.

-- competitors -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ops.competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type      TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name      TEXT NOT NULL,
  key_id          UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL UNIQUE,
  url             TEXT,
  edge_notes      TEXT,
  latest_findings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_competitors_last_checked_idx
  ON ops.competitors (last_checked_at NULLS FIRST);

-- incidents ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ops.incidents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type        TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name        TEXT NOT NULL,
  key_id            UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source            TEXT NOT NULL
                    CHECK (source IN ('app_error', 'qa_failure', 'security_probe', 'customer_pulse', 'other')),
  severity          TEXT NOT NULL
                    CHECK (severity IN ('low', 'med', 'high', 'critical')),
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'triaging', 'resolved', 'wontfix')),
  title             TEXT NOT NULL,
  body              TEXT,
  assigned_agent    TEXT,
  context           JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at       TIMESTAMPTZ,
  sms_escalated_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_incidents_status_severity_idx
  ON ops.incidents (status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_incidents_created_idx
  ON ops.incidents (created_at DESC);

-- social_drafts -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS ops.social_drafts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type          TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name          TEXT NOT NULL,
  key_id              UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  topic               TEXT NOT NULL,
  channel             TEXT NOT NULL
                      CHECK (channel IN ('blog', 'twitter', 'linkedin', 'youtube_short', 'reddit', 'other')),
  draft_body          TEXT NOT NULL,
  source_pain_points  JSONB NOT NULL DEFAULT '[]'::jsonb,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'approved', 'posted', 'rejected')),
  posted_at           TIMESTAMPTZ,
  posted_url          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_social_drafts_status_created_idx
  ON ops.social_drafts (status, created_at DESC);

-- docs --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ops.docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name    TEXT NOT NULL,
  key_id        UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  commit_range  TEXT NOT NULL UNIQUE,
  module        TEXT NOT NULL,
  summary_md    TEXT NOT NULL,
  file_paths    TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_docs_created_idx ON ops.docs (created_at DESC);
CREATE INDEX IF NOT EXISTS ops_docs_module_idx  ON ops.docs (module, created_at DESC);

-- RLS + grants ------------------------------------------------------------

ALTER TABLE ops.competitors    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.incidents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.social_drafts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.docs           ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ops.competitors, ops.incidents, ops.social_drafts, ops.docs
  TO service_role;
