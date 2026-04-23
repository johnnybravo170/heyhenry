-- Manual approval override for estimates and change orders.
--
-- Context: customers don't always approve digitally via the email link.
-- Sometimes they say yes over text, phone, or in person. We need to let
-- the operator mark an estimate / CO as approved on the customer's
-- behalf, and keep a paper trail of how and with what proof.
--
-- Design: four new columns on each of `projects` (estimate) and
-- `change_orders`. The existing `*_approved_by_name` column already
-- captures the customer's stated name; these new columns add:
--
--   - approval_method: how they said yes (digital vs text/phone/email/
--     in-person)
--   - approved_by_member_id: which operator marked it (audit trail)
--   - approval_proof_paths: storage keys to uploaded screenshots / PDFs
--     / etc. in the new `approval-proofs` bucket
--   - approval_notes: free text (e.g. "confirmed over phone 2:30pm")
--
-- NULL method on existing rows means the historical digital path —
-- customers who clicked the approve link in email.
--
-- Kanban card: manual-approval-override

BEGIN;

-- =============================================================
-- projects: estimate manual-approval fields
-- =============================================================
ALTER TABLE public.projects
  ADD COLUMN estimate_approval_method TEXT
    CHECK (estimate_approval_method IS NULL OR estimate_approval_method IN (
      'digital', 'manual_text', 'manual_phone', 'manual_inperson', 'manual_email'
    )),
  ADD COLUMN estimate_approved_by_member_id UUID
    REFERENCES public.tenant_members (id) ON DELETE SET NULL,
  ADD COLUMN estimate_approval_proof_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN estimate_approval_notes TEXT;

-- Backfill: any row already marked approved/declined before this migration
-- came in via the digital path.
UPDATE public.projects
  SET estimate_approval_method = 'digital'
  WHERE estimate_status IN ('approved', 'declined')
    AND estimate_approval_method IS NULL;

-- =============================================================
-- change_orders: same four fields
-- =============================================================
ALTER TABLE public.change_orders
  ADD COLUMN approval_method TEXT
    CHECK (approval_method IS NULL OR approval_method IN (
      'digital', 'manual_text', 'manual_phone', 'manual_inperson', 'manual_email'
    )),
  ADD COLUMN approved_by_member_id UUID
    REFERENCES public.tenant_members (id) ON DELETE SET NULL,
  ADD COLUMN approval_proof_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN approval_notes TEXT;

UPDATE public.change_orders
  SET approval_method = 'digital'
  WHERE status IN ('approved', 'declined')
    AND approval_method IS NULL;

-- =============================================================
-- Storage: approval-proofs bucket
-- =============================================================
-- Files are stored under `{tenant_id}/{resource_type}/{resource_id}/{uuid}.{ext}`
-- where resource_type is 'estimate' or 'change_order'. The tenant_id prefix
-- keeps the RLS policy simple and mirrors our receipts / share-drafts buckets.

INSERT INTO storage.buckets (id, name, public)
VALUES ('approval-proofs', 'approval-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "approval_proofs_select_own_tenant"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'approval-proofs'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

CREATE POLICY "approval_proofs_insert_own_tenant"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'approval-proofs'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

CREATE POLICY "approval_proofs_delete_own_tenant"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'approval-proofs'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

COMMIT;
