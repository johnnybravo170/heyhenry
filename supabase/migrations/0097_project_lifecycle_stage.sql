-- Unified project lifecycle stage.
--
-- Before this migration, project state was split across two columns that
-- disagreed in practice:
--   projects.status          (planning / in_progress / complete / cancelled)
--   projects.estimate_status (draft / pending_approval / approved / declined)
--
-- `status` defaulted to 'planning' on insert and was almost never moved;
-- `estimate_status` tracked the estimate's own state. A project with an
-- approved estimate and an approved change order could still read
-- status = 'planning' and confuse every dashboard filter.
--
-- This migration introduces `lifecycle_stage` as the single authoritative
-- column. `estimate_status` stays, but only as a sub-state inside the
-- planning / awaiting_approval stages. See PROJECT_LIFECYCLE_PLAN.md for
-- the full design + state machine. Kanban card: 8190d7f2.
--
-- projects.status is kept (but no longer written) for one deploy cycle so
-- a rollback is cheap. Phase 3 drops it.

BEGIN;

-- 1. Add lifecycle_stage + resumed_from_stage (for on-hold round-trips).
ALTER TABLE projects
  ADD COLUMN lifecycle_stage TEXT,
  ADD COLUMN resumed_from_stage TEXT;

-- 2. Backfill from the old two-column state. Order of clauses matters:
--    terminal lifecycle states (cancelled/complete) win over estimate state,
--    then declined estimates, then approval flow, then default to planning.
UPDATE projects
SET lifecycle_stage = CASE
  WHEN status = 'cancelled'                 THEN 'cancelled'
  WHEN status = 'complete'                  THEN 'complete'
  WHEN estimate_status = 'declined'         THEN 'declined'
  WHEN estimate_status = 'approved'         THEN 'active'
  WHEN estimate_status = 'pending_approval' THEN 'awaiting_approval'
  ELSE 'planning'
END;

-- 3. Enforce.
ALTER TABLE projects
  ALTER COLUMN lifecycle_stage SET NOT NULL,
  ALTER COLUMN lifecycle_stage SET DEFAULT 'planning';

ALTER TABLE projects
  ADD CONSTRAINT projects_lifecycle_stage_check CHECK (
    lifecycle_stage IN (
      'planning',
      'awaiting_approval',
      'active',
      'on_hold',
      'declined',
      'complete',
      'cancelled'
    )
  );

ALTER TABLE projects
  ADD CONSTRAINT projects_resumed_from_stage_check CHECK (
    resumed_from_stage IS NULL OR resumed_from_stage IN (
      'planning',
      'awaiting_approval',
      'active'
    )
  );

-- 4. Index for the filter-heavy dashboard + /projects tab queries.
CREATE INDEX idx_projects_lifecycle_stage
  ON projects (tenant_id, lifecycle_stage)
  WHERE deleted_at IS NULL;

-- 5. Drop the dead `phase` column (from 0031_renovation_phase_r1; never
--    written or read in practice).
ALTER TABLE projects DROP COLUMN IF EXISTS phase;

COMMIT;
