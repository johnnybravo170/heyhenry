-- 20260525221410_project_budget_sections_expand.sql
--
-- EXPAND step (1 of 3) toward making internal budget sections a real entity.
--
-- Today `project_budget_categories.section` is a free-text string; a section
-- exists only as a distinct value of that column. That causes recurring pain:
-- empty sections can't exist, rename is an O(categories) bulk string update,
-- there's no section ordering/description, and typos spawn phantom sections.
-- The CUSTOMER-facing grouping is already a real table
-- (project_customer_sections); this makes the INTERNAL side symmetric. The two
-- stay deliberately separate (internal scope org vs client presentation).
--
-- This migration is ADDITIVE and ships NO behavior change: it creates the
-- table, adds a nullable section_id FK, and backfills both from the existing
-- free-text data. Reads/writes still use the `section` string until the next
-- PR flips them (migrate step), after which a later PR drops the column
-- (contract step). Categories created between this migration and the migrate
-- step get section_id = NULL; the migrate step re-runs the backfill to catch
-- them. Plan: Ops vault "Plan: project_budget_sections".

-- 1. The entity (mirrors project_customer_sections) -------------------------
CREATE TABLE IF NOT EXISTS public.project_budget_sections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description_md  text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pbs_project ON public.project_budget_sections (project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pbs_tenant ON public.project_budget_sections (tenant_id);
-- One section name per project — integrity + makes the backfill idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pbs_project_name ON public.project_budget_sections (project_id, name);

ALTER TABLE public.project_budget_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_pbs" ON public.project_budget_sections
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_insert_pbs" ON public.project_budget_sections
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_update_pbs" ON public.project_budget_sections
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_delete_pbs" ON public.project_budget_sections
  FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

COMMENT ON TABLE public.project_budget_sections IS
  'Internal budget sections (scope groupings on the budget table). Real-entity replacement for the free-text project_budget_categories.section column. Separate from project_customer_sections (client-facing presentation groupings).';

-- 2. FK on categories -------------------------------------------------------
ALTER TABLE public.project_budget_categories
  ADD COLUMN IF NOT EXISTS section_id uuid
    REFERENCES public.project_budget_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pbc_section_id ON public.project_budget_categories (section_id);

-- 3. Backfill ---------------------------------------------------------------
-- 3a. One section row per (project, distinct non-empty section string).
--     sort_order seeded from the smallest category display_order in that
--     section so the existing on-screen order is preserved. ON CONFLICT keeps
--     this idempotent if ever re-applied.
INSERT INTO public.project_budget_sections (tenant_id, project_id, name, sort_order)
SELECT tenant_id, project_id, section, MIN(display_order) AS sort_order
FROM public.project_budget_categories
WHERE section IS NOT NULL AND btrim(section) <> ''
GROUP BY tenant_id, project_id, section
ON CONFLICT (project_id, name) DO NOTHING;

-- 3b. Point each category at its section row (exact name match within project).
--     Categories with NULL/empty section stay section_id = NULL ("Other").
UPDATE public.project_budget_categories c
SET section_id = s.id
FROM public.project_budget_sections s
WHERE s.project_id = c.project_id
  AND s.name = c.section
  AND c.section IS NOT NULL
  AND btrim(c.section) <> ''
  AND c.section_id IS DISTINCT FROM s.id;
