-- 20260525163048_rename_home_record_to_property_record.sql
--
-- Rename the "Home Record" feature spine to "Property Record". The product
-- term changed: contractors do commercial work too, and "home" wrongly
-- implies residential. This forward migration renames the live schema so the
-- DB matches the code + UI terminology end-to-end (no half-rename).
--
-- Scope of THIS migration (the durable, DB-side half):
--   1. Rename table  home_records → property_records
--   2. Rename its indexes, constraints (pkey / slug unique / FKs) and RLS
--      policies so an operator inspecting \d property_records sees no stale
--      "home_record" names.
--   3. Create the new storage buckets property-record-pdfs / -zips with the
--      same per-tenant RLS pattern. (Object copy old→new is a one-time
--      service-role script: scripts/migrate-property-record-buckets.mjs.
--      The OLD buckets are left in place here; drop them only after the copy
--      is verified and the new code is live.)
--   4. Backfill the CASL categorization label
--      email_send_log.related_type 'home_record' → 'property_record'.
--      Only the index/category column is touched — the immutable evidence
--      JSONB (consent_events / caslEvidence) is left exactly as written.
--
-- DEPLOY NOTE: a plain table rename is a fast metadata-only op but it is
-- *breaking* DDL — the code that reads property_records must deploy together
-- with this migration. This feature is low-write (a Property Record is
-- generated as a deliberate, rare close-out action), so the apply→deploy
-- window only affects Property Record generation/view for a few seconds, not
-- any core flow. Apply this migration as part of the same ship as the code.
--
-- Historical migrations (0127/0128/0129/…_henry_summary) are NOT edited —
-- they correctly created the objects under the old name at their point in
-- time. This file renames forward.

-- 1. Table -------------------------------------------------------------------
ALTER TABLE public.home_records RENAME TO property_records;

-- 2a. Constraints (pkey, slug unique, FKs) — renamed defensively by pattern
--     so we don't depend on exact auto-generated names.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.property_records'::regclass
      AND conname LIKE 'home_records%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.property_records RENAME CONSTRAINT %I TO %I',
      r.conname,
      replace(r.conname, 'home_records', 'property_records')
    );
  END LOOP;
END $$;

-- 2b. Standalone indexes (uq_home_records_project, idx_home_records_tenant).
--     Constraint-backed indexes were already renamed alongside their
--     constraints above, so anything still matching here is a plain index.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'property_records'
      AND indexname LIKE '%home_records%'
  LOOP
    EXECUTE format(
      'ALTER INDEX public.%I RENAME TO %I',
      r.indexname,
      replace(r.indexname, 'home_records', 'property_records')
    );
  END LOOP;
END $$;

-- 2c. RLS policies (known names from 0127).
ALTER POLICY tenant_select_home_records       ON public.property_records RENAME TO tenant_select_property_records;
ALTER POLICY tenant_insert_home_records       ON public.property_records RENAME TO tenant_insert_property_records;
ALTER POLICY tenant_update_home_records       ON public.property_records RENAME TO tenant_update_property_records;
ALTER POLICY tenant_delete_home_records       ON public.property_records RENAME TO tenant_delete_property_records;
ALTER POLICY anon_select_home_records_by_slug ON public.property_records RENAME TO anon_select_property_records_by_slug;

-- 2d. Table comment.
COMMENT ON TABLE public.property_records IS
  'Permanent Property Record handoff package — frozen JSONB snapshot of phases, photos (storage paths only), selections, documents, decisions, COs at project close. Powers the public /property-record/<slug> route. PDF, ZIP, and email delivery build on top of this. (Renamed from home_records 2026-05; was the Customer Portal & Home Record build.)';

-- 3. New storage buckets ------------------------------------------------------
-- property-record-pdfs
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-record-pdfs', 'property-record-pdfs', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tenant_select_property_record_pdfs" ON storage.objects;
CREATE POLICY "tenant_select_property_record_pdfs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-record-pdfs'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "tenant_insert_property_record_pdfs" ON storage.objects;
CREATE POLICY "tenant_insert_property_record_pdfs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-record-pdfs'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "tenant_update_property_record_pdfs" ON storage.objects;
CREATE POLICY "tenant_update_property_record_pdfs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'property-record-pdfs'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  )
  WITH CHECK (
    bucket_id = 'property-record-pdfs'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "tenant_delete_property_record_pdfs" ON storage.objects;
CREATE POLICY "tenant_delete_property_record_pdfs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-record-pdfs'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

-- property-record-zips
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-record-zips', 'property-record-zips', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tenant_select_property_record_zips" ON storage.objects;
CREATE POLICY "tenant_select_property_record_zips" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-record-zips'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "tenant_insert_property_record_zips" ON storage.objects;
CREATE POLICY "tenant_insert_property_record_zips" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-record-zips'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "tenant_update_property_record_zips" ON storage.objects;
CREATE POLICY "tenant_update_property_record_zips" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'property-record-zips'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  )
  WITH CHECK (
    bucket_id = 'property-record-zips'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "tenant_delete_property_record_zips" ON storage.objects;
CREATE POLICY "tenant_delete_property_record_zips" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-record-zips'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

-- 4. CASL categorization label backfill --------------------------------------
-- Index/category column only; evidence JSONB is left immutable.
UPDATE public.email_send_log
SET related_type = 'property_record'
WHERE related_type = 'home_record';
