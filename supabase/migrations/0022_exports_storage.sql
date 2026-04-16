-- 0022_exports_storage.sql
-- Storage bucket for PIPEDA-compliant data exports.
-- Path convention: `{tenant_id}/{export_id}.zip`
-- Tenant isolation via current_tenant_id() same as photos/quotes buckets.

-- Create the private storage bucket.
insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;

-- SELECT: tenant can download their own exports.
drop policy if exists "tenant_select_exports" on storage.objects;
create policy "tenant_select_exports" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'exports'
    and (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

-- INSERT: server action uploads exports scoped to tenant.
drop policy if exists "tenant_insert_exports" on storage.objects;
create policy "tenant_insert_exports" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'exports'
    and (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );

-- DELETE: tenant can clean up old exports.
drop policy if exists "tenant_delete_exports" on storage.objects;
create policy "tenant_delete_exports" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'exports'
    and (split_part(name, '/', 1))::uuid = public.current_tenant_id()
  );
