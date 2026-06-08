-- 20260526163958_agreement_acceptances.sql
--
-- A versioned, append-only ledger of signed agreement acceptances, one row
-- per (tenant, agreement_type, version) acceptance event.
--
-- Why generic (not founding-specific): founders sign a unique founding-member
-- agreement, but EVERY tenant will eventually sign a base ToS — and later a
-- Privacy Policy / DPA once the SaaS lawyer drafts them. Rather than a column
-- per document, an acceptance is (agreement_type, agreement_version) so the
-- same table + e-sign component + server actions serve all of them with no
-- rework. Today only 'founding_member' is wired; 'tos' etc. land later.
--
-- This is a *signed* acceptance (typed full-name e-signature + IP + UA),
-- distinct from the lightweight clickwrap booleans on tenant_members
-- (tos_version/tos_accepted_at, mig 20260509022856) which record passive
-- policy acknowledgement. This table is the audit-grade contract trail.
--
-- Append-only: a tenant re-signs on a version bump and we keep every prior
-- acceptance. "Has tenant X accepted type Y?" = EXISTS on the latest version;
-- "what did they sign and when?" = the full row history.
--
-- See PATTERNS.md §11 — this table needs a cross-tenant RLS test entry in the
-- same PR.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agreement_acceptances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,

  -- The signing user (the tenant member who clicked through + typed their
  -- name). References auth.users; survives even if the membership is later
  -- removed, so the signature record stays intact.
  user_id           UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  -- Which document. 'founding_member' is the only type wired today; 'tos',
  -- 'privacy', 'dpa' follow when the lawyer copy exists. Free text rather
  -- than an enum so adding a document type is code-only, no migration.
  agreement_type    TEXT NOT NULL CHECK (length(trim(agreement_type)) > 0),

  -- Version of the document that was accepted. Date-string convention to
  -- match the existing tenant_members.tos_version pattern (e.g. '2026-05-26').
  agreement_version TEXT NOT NULL CHECK (length(trim(agreement_version)) > 0),

  -- Typed full name = the e-signature, exactly as the change-order / estimate
  -- approval flow does it ("type your name to sign — same as on paper").
  signature_name    TEXT NOT NULL CHECK (length(trim(signature_name)) > 0),

  -- Evidence captured at signing time for the audit trail.
  ip_address        TEXT,
  user_agent        TEXT,

  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Has this tenant accepted this document (any version)?" and the latest-
-- version lookup both ride this index.
CREATE INDEX IF NOT EXISTS idx_agreement_acceptances_tenant_type
  ON public.agreement_acceptances (tenant_id, agreement_type, accepted_at DESC);

-- ============================================================
-- RLS — tenant-scoped, same shape as payment_sources (mig 0194).
--
-- Reads go through the authed client (onboarding gate / billing page check
-- acceptance status). Inserts happen via the admin client in the server
-- action so IP/UA are captured server-side and can't be spoofed by the
-- browser — but we still declare the INSERT policy (tenant + self) as
-- defense-in-depth and so the §11 cross-tenant WITH CHECK test has a target.
--
-- No UPDATE / DELETE policies: acceptances are append-only and immutable.
-- ============================================================
ALTER TABLE public.agreement_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agreement_acceptances_tenant_select ON public.agreement_acceptances;
CREATE POLICY agreement_acceptances_tenant_select ON public.agreement_acceptances
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS agreement_acceptances_tenant_insert ON public.agreement_acceptances;
CREATE POLICY agreement_acceptances_tenant_insert ON public.agreement_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

COMMENT ON TABLE public.agreement_acceptances IS
  'Append-only ledger of signed agreement acceptances (typed-name e-signature + IP + UA), one row per (tenant, agreement_type, version) event. Generic by design: founding_member today, tos/privacy/dpa later — same table, no per-document columns. Distinct from the lightweight clickwrap booleans on tenant_members.';

COMMIT;
