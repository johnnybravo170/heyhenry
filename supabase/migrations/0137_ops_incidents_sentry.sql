-- Add Sentry as a recognised incident source + columns to dedupe across
-- Sentry alert re-fires (one Sentry issue should map to one ops incident,
-- and subsequent alerts on the same issue just bump event_count rather
-- than spawning duplicate incidents).

-- 1. Extend the source CHECK constraint to include 'sentry'.
ALTER TABLE ops.incidents
  DROP CONSTRAINT IF EXISTS incidents_source_check;

ALTER TABLE ops.incidents
  ADD CONSTRAINT incidents_source_check
  CHECK (source IN ('app_error', 'qa_failure', 'security_probe', 'customer_pulse', 'sentry', 'other'));

-- 2. Sentry-specific columns.
ALTER TABLE ops.incidents
  ADD COLUMN IF NOT EXISTS sentry_issue_id  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS sentry_issue_url TEXT,
  ADD COLUMN IF NOT EXISTS event_count      INTEGER NOT NULL DEFAULT 1;

-- 3. Lookup index for the upsert path (UNIQUE already creates one but the
-- explicit name documents intent).
CREATE INDEX IF NOT EXISTS ops_incidents_sentry_issue_id_idx
  ON ops.incidents (sentry_issue_id)
  WHERE sentry_issue_id IS NOT NULL;
