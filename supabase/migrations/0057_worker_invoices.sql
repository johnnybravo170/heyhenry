-- W6: Subcontractor invoicing.
-- These invoices are presentation/payment-tracking only — the underlying
-- time_entries and expenses are what drive project P&L. The worker_invoice_id
-- stamp on those rows prevents double-billing, nothing more.

-- 1. Tax rate on worker profile (default 5% GST; sub can clear to 0).
ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0500;

-- 2. Invoices.
CREATE TABLE IF NOT EXISTS public.worker_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_profile_id UUID NOT NULL REFERENCES public.worker_profiles (id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  subtotal_cents BIGINT NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  tax_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_invoices_tenant
  ON public.worker_invoices (tenant_id);
CREATE INDEX IF NOT EXISTS idx_worker_invoices_worker
  ON public.worker_invoices (worker_profile_id);
CREATE INDEX IF NOT EXISTS idx_worker_invoices_project
  ON public.worker_invoices (project_id);
CREATE INDEX IF NOT EXISTS idx_worker_invoices_status
  ON public.worker_invoices (tenant_id, status);

-- 3. Billable-row stamps. Nullable FK keeps historical rows untouched.
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS worker_invoice_id UUID
  REFERENCES public.worker_invoices (id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS worker_invoice_id UUID
  REFERENCES public.worker_invoices (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_worker_invoice
  ON public.time_entries (worker_invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_worker_invoice
  ON public.expenses (worker_invoice_id);

-- 4. RLS: workers see/manage their own invoices; owners/admins see all tenant.
ALTER TABLE public.worker_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY worker_invoices_self_select ON public.worker_invoices
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      worker_profile_id IN (
        SELECT wp.id FROM public.worker_profiles wp
        INNER JOIN public.tenant_members tm ON tm.id = wp.tenant_member_id
        WHERE tm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_members.user_id = auth.uid()
          AND tenant_members.tenant_id = worker_invoices.tenant_id
          AND tenant_members.role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY worker_invoices_self_insert ON public.worker_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND worker_profile_id IN (
      SELECT wp.id FROM public.worker_profiles wp
      INNER JOIN public.tenant_members tm ON tm.id = wp.tenant_member_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY worker_invoices_self_update ON public.worker_invoices
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      worker_profile_id IN (
        SELECT wp.id FROM public.worker_profiles wp
        INNER JOIN public.tenant_members tm ON tm.id = wp.tenant_member_id
        WHERE tm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_members.user_id = auth.uid()
          AND tenant_members.tenant_id = worker_invoices.tenant_id
          AND tenant_members.role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY worker_invoices_self_delete ON public.worker_invoices
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND worker_profile_id IN (
      SELECT wp.id FROM public.worker_profiles wp
      INNER JOIN public.tenant_members tm ON tm.id = wp.tenant_member_id
      WHERE tm.user_id = auth.uid()
    )
  );
