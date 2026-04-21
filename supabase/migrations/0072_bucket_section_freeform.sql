-- ============================================================
-- 0072_bucket_section_freeform.sql
--
-- Relax the project_cost_buckets.section CHECK constraint from the fixed
-- {'interior','exterior','general'} set to a free-form TEXT field. The PDF
-- quote-import flow preserves contractor section names verbatim (e.g.
-- "UPSTAIRS WORK", "DOWNSTAIRS", "Demolition") and the original 3-value
-- enum was blocking those inserts. Tenants pick whatever section
-- vocabulary their quotes use.
--
-- We keep NOT NULL but drop the CHECK. Existing rows are unaffected.
-- ============================================================

ALTER TABLE public.project_cost_buckets
  DROP CONSTRAINT IF EXISTS project_cost_buckets_section_check;
