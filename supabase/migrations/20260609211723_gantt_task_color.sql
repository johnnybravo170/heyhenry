-- Add a per-task custom colour to the Gantt bar.
--
-- Nullable: NULL means "use the phase/trade-derived colour" (existing behaviour).
-- When set, the value is a CSS colour token from a fixed palette (e.g. 'blue',
-- 'red', 'green', 'orange', 'purple', 'pink', 'amber', 'teal') so the app
-- can map it to Tailwind classes without storing raw hex.
--
-- Additive + nullable; project_schedule_tasks already has its grants.

ALTER TABLE public.project_schedule_tasks
  ADD COLUMN bar_color TEXT;
