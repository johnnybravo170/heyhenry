-- Drop the legacy `projects.status` column.
--
-- Phase 3 of the project lifecycle unification (kanban card 8190d7f2).
-- Migration 0097 added `lifecycle_stage` and backfilled from status +
-- estimate_status. All writers now set lifecycle_stage; all readers
-- filter on it. `status` has no remaining references — safe to drop.
--
-- Numbered 0099 to step past 0098_ops_kanban.sql (concurrent WIP).
--
-- Drops:
--   - projects.status column
--   - idx_projects_status index (auto-dropped with the column)
--   - projects_status_check constraint (auto-dropped with the column)

BEGIN;

ALTER TABLE projects DROP COLUMN status;

COMMIT;
