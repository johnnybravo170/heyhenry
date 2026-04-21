-- Worker profiles + tenant-wide worker capability defaults.
-- Phase W1 of the worker module. Assignments / worker_invoices / project_assignments
-- arrive in later phases so the initial auth + profile ship can go out on its own.

-- 1. Tenant-wide defaults for what workers are allowed to do.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS workers_can_log_expenses BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS workers_can_invoice_default BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Worker profile (1:1 with tenant_members where role='worker').
CREATE TABLE IF NOT EXISTS public.worker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  tenant_member_id UUID NOT NULL UNIQUE
    REFERENCES public.tenant_members (id) ON DELETE CASCADE,
  worker_type TEXT NOT NULL DEFAULT 'employee'
    CHECK (worker_type IN ('employee', 'subcontractor')),
  display_name TEXT,
  phone TEXT,
  business_name TEXT,
  gst_number TEXT,
  address TEXT,
  default_hourly_rate_cents INTEGER,
  -- Per-worker capability overrides. NULL = inherit tenant default.
  can_log_expenses BOOLEAN,
  can_invoice BOOLEAN,
  nudge_email BOOLEAN NOT NULL DEFAULT TRUE,
  nudge_sms BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_profiles_tenant
  ON public.worker_profiles (tenant_id);

-- 3. RLS.
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;

-- Workers see and update their own profile.
CREATE POLICY worker_profiles_self_select ON public.worker_profiles
  FOR SELECT
  USING (
    tenant_member_id IN (
      SELECT id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY worker_profiles_self_update ON public.worker_profiles
  FOR UPDATE
  USING (
    tenant_member_id IN (
      SELECT id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

-- Owners/admins see and manage profiles for their tenant.
CREATE POLICY worker_profiles_tenant_admin_all ON public.worker_profiles
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
