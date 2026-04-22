-- Add default hourly rate to tenant_members so owners/admins can set
-- their own labour cost rate for time entries logged from the dashboard.
ALTER TABLE public.tenant_members
  ADD COLUMN IF NOT EXISTS default_hourly_rate_cents INTEGER;
