-- 0070_ops_maintenance_runs.sql
-- Audit trail for weekly maintenance runs.

CREATE TABLE IF NOT EXISTS ops.maintenance_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT NOT NULL DEFAULT 'weekly',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  duration_ms  INTEGER,
  tasks        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_maintenance_runs_time_idx
  ON ops.maintenance_runs (started_at DESC);

ALTER TABLE ops.maintenance_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON ops.maintenance_runs TO service_role;
