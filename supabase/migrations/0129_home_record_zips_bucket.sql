-- 0129_home_record_zips_bucket.sql
-- Slice 6c of the Customer Portal & Home Record build.
--
-- Private bucket for generated Home Record ZIP archives. Same path
-- convention and RLS pattern as photos / project-docs / home-record-pdfs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('home-record-zips', 'home-record-zips', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tenant_select_home_record_zips" ON storage.objects;
CREATE POLICY "tenant_select_home_record_zips" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'home-record-zips'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "tenant_insert_home_record_zips" ON storage.objects;
CREATE POLICY "tenant_insert_home_record_zips" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'home-record-zips'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "tenant_update_home_record_zips" ON storage.objects;
CREATE POLICY "tenant_update_home_record_zips" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'home-record-zips'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  )
  WITH CHECK (
    bucket_id = 'home-record-zips'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "tenant_delete_home_record_zips" ON storage.objects;
CREATE POLICY "tenant_delete_home_record_zips" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'home-record-zips'
    AND (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );
