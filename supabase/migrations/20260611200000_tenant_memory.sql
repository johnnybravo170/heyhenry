-- Cascading Preferences substrate (step 1).
-- Generic key/value store scoped to a tenant. Document-label overrides
-- are the first consumer; future tiers (user_memory, auto-learn) extend
-- the same shape rather than adding per-purpose columns.
--
-- key namespace convention: 'label.{doc}.{field}'
--   e.g. 'label.estimate.total', 'label.invoice.total'
--
-- value is jsonb (not text) so future prefs can be number/bool/object
-- without a re-migration. The typed accessor in queries/tenant-memory.ts
-- asserts string + falls back to default for any non-string jsonb.

create table public.tenant_memory (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  key         text        not null,
  value       jsonb       not null,
  kind        text        not null default 'preference'
              check (kind in ('preference', 'voice', 'rule', 'observation')),
  updated_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, key)
);

create index tenant_memory_tenant_idx on public.tenant_memory(tenant_id);

-- Trigger to keep updated_at current on upserts.
create or replace function public.set_tenant_memory_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenant_memory_set_updated_at
  before update on public.tenant_memory
  for each row execute procedure public.set_tenant_memory_updated_at();

-- RLS: tenant members read/write their own rows; service_role bypasses.
alter table public.tenant_memory enable row level security;

create policy "tenant_memory_select" on public.tenant_memory
  for select using (
    tenant_id in (
      select tm.tenant_id from public.tenant_members tm
      where tm.user_id = auth.uid()
    )
  );

create policy "tenant_memory_insert" on public.tenant_memory
  for insert with check (
    tenant_id in (
      select tm.tenant_id from public.tenant_members tm
      where tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

create policy "tenant_memory_update" on public.tenant_memory
  for update using (
    tenant_id in (
      select tm.tenant_id from public.tenant_members tm
      where tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

create policy "tenant_memory_delete" on public.tenant_memory
  for delete using (
    tenant_id in (
      select tm.tenant_id from public.tenant_members tm
      where tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

grant select, insert, update, delete on public.tenant_memory to authenticated;
grant all on public.tenant_memory to service_role;
