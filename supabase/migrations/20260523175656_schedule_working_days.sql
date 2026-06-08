-- schedule_working_days.sql
-- Working-day durations on the per-project Gantt.
--
-- Today `planned_duration_days` is applied as raw CALENDAR days, so an
-- "8 day" task starting Thursday burns two weekends and lands ~12 days
-- out — wrong for a crew that works Mon–Fri. Going forward, new tasks
-- count WORKING days (skip Sat/Sun) by default.
--
-- Non-destructive cutover (decision: add a duration_basis column rather
-- than recompute existing dates):
--   - duration_basis defaults to 'working' for NEW rows, but EVERY
--     existing row is backfilled to 'calendar' so no live customer
--     schedule shifts under them. The going-forward default is 'working'.
--   - works_weekends is a per-task override: when true, the task counts
--     calendar days even under the 'working' basis (concrete pours, a GC
--     pushing a deadline with their own crew, etc).

ALTER TABLE public.project_schedule_tasks
  ADD COLUMN IF NOT EXISTS duration_basis TEXT NOT NULL DEFAULT 'working'
    CHECK (duration_basis IN ('working', 'calendar')),
  ADD COLUMN IF NOT EXISTS works_weekends BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: every row that exists today was authored as calendar days.
-- Pin them to 'calendar' so their rendered end dates don't move. New
-- rows inserted after this migration keep the 'working' default.
UPDATE public.project_schedule_tasks
SET duration_basis = 'calendar';

COMMENT ON COLUMN public.project_schedule_tasks.duration_basis IS
  'How planned_duration_days is interpreted. ''working'' (default for new rows) skips Sat/Sun; ''calendar'' counts raw days. Existing rows backfilled to ''calendar'' so historic schedules don''t shift.';
COMMENT ON COLUMN public.project_schedule_tasks.works_weekends IS
  'Per-task override: when TRUE the task spans weekends like calendar days even under the ''working'' basis (concrete pours, deadline pushes).';
