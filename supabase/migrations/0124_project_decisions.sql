-- 0124_project_decisions.sql
-- Slice 3 of the Customer Portal & Home Record build.
--
-- A homeowner-facing decision queue. The operator creates decisions
-- ("pick a paint color", "confirm tile layout", "approve allowance
-- adjustment") with optional reference photos and a due date; the
-- homeowner sees them at the top of /portal/<slug> and can Approve,
-- Decline, or Ask a question, with no login.
--
-- Deliberately parallel to `change_orders.approval_code` so the same
-- SMS / email "tap to approve" flow can ride either type from Slice 7.
-- A decision's `approval_code` lets a homeowner respond without going
-- through the full portal — useful when SMS lands and they tap from
-- their phone in 5 seconds.
--
-- The "Ask" action posts a message back; for V1 it lands as a
-- project_portal_updates row of type='message' so it shows up in the
-- updates feed and the operator gets it via the existing notification
-- path. Slice 7 will route it more directly.

CREATE TABLE IF NOT EXISTS public.project_decisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,

  label         TEXT NOT NULL,
  description   TEXT,
  due_date      DATE,

  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'decided', 'dismissed')),

  -- When status='decided': what the homeowner picked.
  decided_value TEXT,
  decided_at    TIMESTAMPTZ,
  -- The customer's name as captured on the approval page (matches CO).
  decided_by_customer TEXT,

  -- Optional reference photos: array of { photo_id, storage_path,
  -- caption? }. Resolved to signed URLs at render time.
  photo_refs    JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Public approval code — same shape and purpose as change_orders.
  approval_code TEXT UNIQUE,

  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_decisions_project_status
  ON public.project_decisions (project_id, status);

CREATE INDEX IF NOT EXISTS idx_project_decisions_tenant
  ON public.project_decisions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_project_decisions_approval_code
  ON public.project_decisions (approval_code)
  WHERE approval_code IS NOT NULL;

-- RLS: tenant CRUD + anon SELECT-by-code for the public /decide/<code>
-- page. Anon has NO write access — writes go through server actions
-- using the admin client.
ALTER TABLE public.project_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select_project_decisions ON public.project_decisions
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_insert_project_decisions ON public.project_decisions
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_update_project_decisions ON public.project_decisions
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_delete_project_decisions ON public.project_decisions
  FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

CREATE POLICY anon_select_project_decisions_by_code ON public.project_decisions
  FOR SELECT TO anon USING (approval_code IS NOT NULL);

COMMENT ON TABLE public.project_decisions IS
  'Homeowner-facing decision queue. Mirrors change_orders.approval_code so the same SMS/email tap-to-approve UX (Slice 7) can ride either decisions or COs.';
