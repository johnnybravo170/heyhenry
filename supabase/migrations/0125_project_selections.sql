-- 0125_project_selections.sql
-- Slice 4 of the Customer Portal & Home Record build.
--
-- Per-room material record. The operator captures every paint, tile,
-- flooring, fixture, appliance, hardware, etc. selection during the job;
-- the homeowner sees a read-only "Selections" tab on /portal/<slug> grouped
-- by room. At project close, Slice 6 (Home Record) snapshots this entire
-- table into the permanent handoff package — so building it during the
-- live job means there's no end-of-project scramble to dig up paint
-- codes and SKUs.
--
-- Why a single flat table grouped by room (not a rooms-then-selections
-- relational pair):
--   * Rooms are free-form text — a "Main bathroom" today might become
--     "Master ensuite" tomorrow. No need for a rooms table.
--   * Selections need to be reorderable per-room (display_order) without
--     reorganizing the room itself.
--   * Smaller surface, fewer joins, easier RLS.

CREATE TABLE IF NOT EXISTS public.project_selections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,

  room          TEXT NOT NULL,
  category      TEXT NOT NULL
    CHECK (category IN (
      'paint', 'tile', 'grout', 'flooring', 'trim', 'cabinets',
      'countertop', 'fixture', 'appliance', 'hardware', 'other'
    )),

  -- The data the homeowner actually wants in their handoff:
  brand         TEXT,
  name          TEXT,
  code          TEXT,                 -- paint code, tile SKU, model #
  finish        TEXT,                 -- eggshell, satin, matte, brushed nickel, etc.
  supplier      TEXT,
  sku           TEXT,
  warranty_url  TEXT,
  notes         TEXT,

  -- Photo references — JSONB array of { photo_id, storage_path, caption? }
  -- entries (matching project_decisions.photo_refs shape so the rendering
  -- code is reusable). V1 leaves this empty; Slice 6 / V2 lets the
  -- operator attach photos from the gallery here.
  photo_refs    JSONB NOT NULL DEFAULT '[]'::jsonb,

  display_order INTEGER NOT NULL DEFAULT 0,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_selections_project_room
  ON public.project_selections (project_id, room, display_order);

CREATE INDEX IF NOT EXISTS idx_project_selections_tenant
  ON public.project_selections (tenant_id);

-- RLS: tenant CRUD on authenticated. The public portal uses the admin
-- client (no anon policy needed — selections are not approval-coded).
ALTER TABLE public.project_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select_project_selections ON public.project_selections
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_insert_project_selections ON public.project_selections
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_update_project_selections ON public.project_selections
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_delete_project_selections ON public.project_selections
  FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

COMMENT ON TABLE public.project_selections IS
  'Per-room material record (paint codes, tile SKUs, fixtures, hardware) — drives the Selections tab on /portal/<slug> and the Home Record handoff package (Slice 6).';
