-- 0127_home_records.sql
-- Slice 6a of the Customer Portal & Home Record build.
--
-- The Home Record — a permanent, frozen snapshot of the project at
-- close-out time. The marketing differentiator from the GPT research:
-- "no startup specifically targets small residential renovation
-- contractor + homeowner-facing digital handoff package at project
-- completion." Live for V1: a permanent /home-record/<slug> page
-- powered by a JSONB snapshot. Slice 6b adds PDF, 6c adds ZIP, 6d adds
-- email-to-homeowner.
--
-- The snapshot blob copies the live data at generation time. Storage
-- paths are stored as-is; URLs are re-signed at render time using the
-- admin client (since signed URLs only live ~1 week, we can't bake
-- them in for a permanent record). Caveat: if the operator deletes
-- the underlying blob from Storage later, the home record loses that
-- file. Slice 6c (ZIP archive) durably solves this by copying blobs
-- into a single archive at generation time. Until then, document the
-- caveat and don't block.
--
-- Operators can regenerate to pick up later changes (added photos,
-- final selections, etc) — the slug stays the same so any link
-- already shared with the homeowner keeps working.

CREATE TABLE IF NOT EXISTS public.home_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,

  -- URL-safe slug for the public route, ~16 base64url chars. One per
  -- project — regenerating updates the snapshot in place, doesn't
  -- mint a new slug.
  slug          TEXT NOT NULL UNIQUE,

  -- Frozen denormalized data — see the type in
  -- src/lib/db/queries/home-records.ts for the shape (HomeRecordSnapshot).
  snapshot      JSONB NOT NULL,

  generated_by  UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Bookkeeping for the future PDF / ZIP / email features.
  pdf_path      TEXT,
  zip_path      TEXT,
  emailed_at    TIMESTAMPTZ,
  emailed_to    TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One home record per project (regenerating overwrites in place).
CREATE UNIQUE INDEX IF NOT EXISTS uq_home_records_project
  ON public.home_records (project_id);

CREATE INDEX IF NOT EXISTS idx_home_records_tenant
  ON public.home_records (tenant_id);

ALTER TABLE public.home_records ENABLE ROW LEVEL SECURITY;

-- Tenant CRUD on authenticated.
CREATE POLICY tenant_select_home_records ON public.home_records
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_insert_home_records ON public.home_records
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_update_home_records ON public.home_records
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_delete_home_records ON public.home_records
  FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

-- Anon SELECT-by-slug: the public /home-record/<slug> route uses the
-- service-role admin client and bypasses RLS, but adding the policy
-- doesn't hurt and keeps the table consistent with the rest of the
-- public-by-code surfaces (decisions, COs, pulse).
CREATE POLICY anon_select_home_records_by_slug ON public.home_records
  FOR SELECT TO anon USING (slug IS NOT NULL);

COMMENT ON TABLE public.home_records IS
  'Permanent Home Record handoff package — frozen JSONB snapshot of phases, photos (storage paths only), selections, documents, decisions, COs at project close. Powers the public /home-record/<slug> route. Slice 6b/c/d add PDF, ZIP, and email delivery on top of this.';
