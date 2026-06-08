-- CONTRACT step (3 of 3) for making internal budget sections a real entity.
--
-- The EXPAND migration (20260525221410) added project_budget_sections + a
-- nullable section_id FK on project_budget_categories. The MIGRATE migration
-- (20260525230153) added bidirectional sync triggers as a TEMPORARY bridge so
-- the denormalized `section` string stayed valid while readers/writers moved
-- to section_id one PR at a time.
--
-- Every reader and writer now uses section_id / the joined section entity
-- (verified by a repo-wide grep before this migration). This drops the bridge
-- and the legacy column for good. Single source of truth: project_budget_sections.
--
-- DESTRUCTIVE + effectively irreversible (the `section` string is reconstructable
-- from section_id -> project_budget_sections.name, so no row data is lost, but
-- the column + triggers are gone). Plan: Ops vault "Plan: project_budget_sections".

-- 1. Drop the sync triggers first -- they reference the column + the functions.
DROP TRIGGER IF EXISTS trg_sync_budget_category_section ON public.project_budget_categories;
DROP TRIGGER IF EXISTS trg_cascade_budget_section_rename ON public.project_budget_sections;

-- 2. Drop the trigger functions.
DROP FUNCTION IF EXISTS public.sync_budget_category_section();
DROP FUNCTION IF EXISTS public.cascade_budget_section_rename();

-- 3. Drop the denormalized column. section_id is now authoritative.
ALTER TABLE public.project_budget_categories DROP COLUMN IF EXISTS section;
