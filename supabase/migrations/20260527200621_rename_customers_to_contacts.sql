-- Rename `customers` → `contacts`, and the `customer_id` FK columns → `contact_id`.
--
-- The table has always held every contact kind (customer / vendor / sub / agent
-- / inspector / referral / other) — the `customers` name was legacy. With a
-- single live tenant this same-merge breaking rename is safe on the data side;
-- it ships together with the code that depends on it.
--
-- SURGICAL: we rename only the contacts table + the seven true `customer_id`
-- foreign-key columns. We deliberately DO NOT touch unrelated "customer" names:
--   * tenants.stripe_customer_id        (Stripe's customer id)
--   * intake_drafts.recognized_customer_id (kept as-is; separate follow-up)
--   * project_customer_sections / customer_section_id (customer-FACING grouping)
--   * invoices/projects.customer_view_mode (presentation setting)

-- 1. Table
alter table customers rename to contacts;

-- 2. FK columns: customer_id → contact_id (the 7 referencing tables)
alter table invoices rename column customer_id to contact_id;
alter table jobs rename column customer_id to contact_id;
alter table payments rename column customer_id to contact_id;
alter table photos rename column customer_id to contact_id;
alter table project_idea_board_items rename column customer_id to contact_id;
alter table projects rename column customer_id to contact_id;
alter table quotes rename column customer_id to contact_id;

-- 3. Recreate the two functions whose BODIES reference the old names (function
--    bodies are stored as text and are NOT updated by the renames above).

-- 3a. Contact dedup matcher (was: FROM public.customers)
create or replace function public.find_similar_contacts(
  p_name text,
  p_threshold real default 0.4,
  p_limit integer default 5,
  p_exclude_id uuid default null::uuid
)
returns table(id uuid, name text, kind text, email text, phone text, similarity real)
language sql
stable
as $function$
  select
    c.id,
    c.name,
    c.kind,
    c.email,
    c.phone,
    similarity(c.name, p_name) as similarity
  from public.contacts c
  where c.tenant_id = public.current_tenant_id()
    and c.deleted_at is null
    and (p_exclude_id is null or c.id <> p_exclude_id)
    and similarity(c.name, p_name) >= p_threshold
  order by similarity(c.name, p_name) desc
  limit p_limit;
$function$;

-- 3b. Lead-promotion trigger (was: NEW.customer_id + UPDATE public.customers)
create or replace function public.promote_lead_on_project_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.contact_id is not null then
    update public.contacts
       set kind = 'customer',
           updated_at = now()
     where id = new.contact_id
       and kind = 'lead';
  end if;
  return new;
end;
$function$;

-- 4. Rename contacts-own constraints/indexes for clarity (cosmetic — the app
--    keys on table + column names, not these, but keep them consistent).
alter index customers_pkey rename to contacts_pkey;
alter index customers_phone_idx rename to contacts_phone_idx;
alter index customers_tenant_id_idx rename to contacts_tenant_id_idx;
alter index idx_customers_name_trgm rename to idx_contacts_name_trgm;
alter index customers_tenant_qbo_id_uniq rename to contacts_tenant_qbo_id_uniq;
alter index idx_customers_import_batch rename to idx_contacts_import_batch;
alter index customers_dnam_idx rename to contacts_dnam_idx;
alter index customers_email_lower_idx rename to contacts_email_lower_idx;

alter table contacts rename constraint customers_tenant_id_fkey to contacts_tenant_id_fkey;
alter table contacts rename constraint customers_type_check to contacts_type_check;
alter table contacts rename constraint customers_kind_check to contacts_kind_check;
alter table contacts rename constraint customers_type_requires_customer_kind to contacts_type_requires_customer_kind;
alter table contacts rename constraint customers_do_not_auto_message_source_check to contacts_do_not_auto_message_source_check;
alter table contacts rename constraint customers_import_batch_id_fkey to contacts_import_batch_id_fkey;
alter table contacts rename constraint customers_qbo_sync_status_check to contacts_qbo_sync_status_check;

-- 5. Rename the FK constraints + indexes on the referencing tables.
alter table invoices rename constraint invoices_customer_id_fkey to invoices_contact_id_fkey;
alter table jobs rename constraint jobs_customer_id_fkey to jobs_contact_id_fkey;
alter table payments rename constraint payments_customer_id_fkey to payments_contact_id_fkey;
alter table photos rename constraint photos_customer_id_fkey to photos_contact_id_fkey;
alter table project_idea_board_items
  rename constraint project_idea_board_items_customer_id_fkey to project_idea_board_items_contact_id_fkey;
alter table projects rename constraint projects_customer_id_fkey to projects_contact_id_fkey;
alter table quotes rename constraint quotes_customer_id_fkey to quotes_contact_id_fkey;

alter index invoices_customer_id_idx rename to invoices_contact_id_idx;
alter index jobs_customer_id_idx rename to jobs_contact_id_idx;
alter index quotes_customer_id_idx rename to quotes_contact_id_idx;
alter index idx_projects_customer rename to idx_projects_contact;
alter index photos_tenant_customer_idx rename to photos_tenant_contact_idx;
