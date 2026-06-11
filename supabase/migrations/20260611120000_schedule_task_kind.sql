-- Add task kind column for wildcard (non-trade) tasks like inspection gates.
-- 'trade' = standard subcontractor work (default for all existing rows)
-- 'inspection' = mandatory city/engineer checkpoint that blocks forward progress
ALTER TABLE public.project_schedule_tasks
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'trade'
  CHECK (kind IN ('trade', 'inspection'));
