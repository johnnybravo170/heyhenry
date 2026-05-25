-- MIGRATE step: bidirectional sync so section_id can become authoritative on
-- the budget page while the legacy `section` string stays valid for readers
-- not yet migrated. Triggers are a TEMPORARY bridge; a later PR drops the
-- string + these triggers once all readers use section_id.

-- 0. Re-backfill any categories created since PR1 with a NULL section_id.
INSERT INTO public.project_budget_sections (tenant_id, project_id, name, sort_order)
SELECT tenant_id, project_id, section, MIN(display_order)
FROM public.project_budget_categories
WHERE section IS NOT NULL AND btrim(section) <> ''
GROUP BY tenant_id, project_id, section
ON CONFLICT (project_id, name) DO NOTHING;

UPDATE public.project_budget_categories c
SET section_id = s.id
FROM public.project_budget_sections s
WHERE s.project_id = c.project_id AND s.name = c.section
  AND c.section IS NOT NULL AND btrim(c.section) <> ''
  AND c.section_id IS DISTINCT FROM s.id;

-- 1. Category trigger: reconcile section_id <-> section string on write.
CREATE OR REPLACE FUNCTION public.sync_budget_category_section()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_section_id uuid;
BEGIN
  IF NEW.section_id IS NOT NULL THEN
    -- Row authoritative: mirror its name into the denormalized string.
    SELECT name INTO NEW.section
      FROM public.project_budget_sections WHERE id = NEW.section_id;
  ELSIF NEW.section IS NOT NULL AND btrim(NEW.section) <> '' THEN
    -- Legacy string-only writer: find-or-create the section row, adopt its id.
    SELECT id INTO v_section_id
      FROM public.project_budget_sections
      WHERE project_id = NEW.project_id AND name = NEW.section;
    IF v_section_id IS NULL THEN
      INSERT INTO public.project_budget_sections (tenant_id, project_id, name, sort_order)
      VALUES (NEW.tenant_id, NEW.project_id, NEW.section,
              COALESCE((SELECT MAX(sort_order)+1 FROM public.project_budget_sections WHERE project_id = NEW.project_id), 0))
      ON CONFLICT (project_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_section_id;
    END IF;
    NEW.section_id := v_section_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_budget_category_section ON public.project_budget_categories;
CREATE TRIGGER trg_sync_budget_category_section
  BEFORE INSERT OR UPDATE OF section, section_id ON public.project_budget_categories
  FOR EACH ROW EXECUTE FUNCTION public.sync_budget_category_section();

-- 2. Section trigger: a rename cascades to the denormalized string on categories.
CREATE OR REPLACE FUNCTION public.cascade_budget_section_rename()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.project_budget_categories
      SET section = NEW.name
      WHERE section_id = NEW.id AND section IS DISTINCT FROM NEW.name;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cascade_budget_section_rename ON public.project_budget_sections;
CREATE TRIGGER trg_cascade_budget_section_rename
  AFTER UPDATE OF name ON public.project_budget_sections
  FOR EACH ROW EXECUTE FUNCTION public.cascade_budget_section_rename();
