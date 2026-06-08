-- QBO importer bulk-update functions.
--
-- The per-entity QBO importers (src/lib/qbo/import/*.ts) used to refresh
-- already-linked rows one UPDATE-per-row inside a `for (const u of toUpdate)`
-- loop. On a re-import of a large QBO book that's thousands of sequential
-- round trips inside the 240s import-worker budget. These set-based functions
-- apply the whole page of updates in one statement via jsonb_to_recordset.
--
-- Each function updates EXACTLY the columns the matching importer updated
-- before — no more. In particular it never touches `created_at` or
-- `import_batch_id` (provenance / rollback anchor), and the contacts variant
-- never touches operator-editable fields (name/email/phone/address). This
-- preserves the existing semantics precisely; the only change is round-trip
-- count.
--
-- SECURITY: SECURITY INVOKER (default). Only the service-role import worker
-- (createAdminClient) calls these, so EXECUTE is granted to service_role only
-- and revoked from everyone else — they must never be reachable from a
-- browser-authenticated session. Row scoping is by (id, tenant_id); the ids
-- already come from tenant-scoped context maps, and the tenant_id guard is
-- defense-in-depth.

-- contacts (QBO Customer + Vendor share the contacts table). Sync-metadata
-- only — deliberately does NOT refresh name/email/etc so operator edits to an
-- auto-merged or round-tripped contact are never clobbered.
create or replace function public.qbo_bulk_update_contacts(p_rows jsonb)
returns void
language sql
as $$
  update public.contacts t set
    qbo_customer_id = v.qbo_customer_id,
    qbo_sync_token  = v.qbo_sync_token,
    qbo_sync_status = 'synced',
    qbo_synced_at   = now(),
    updated_at      = now()
  from jsonb_to_recordset(p_rows) as v(
    id uuid,
    tenant_id uuid,
    qbo_customer_id text,
    qbo_sync_token text
  )
  where t.id = v.id and t.tenant_id = v.tenant_id;
$$;

-- invoices. QBO is source of truth on re-import: refresh status / money /
-- line_items / notes. Frozen-money-math invoices only shift if QBO recomputed.
create or replace function public.qbo_bulk_update_invoices(p_rows jsonb)
returns void
language sql
as $$
  update public.invoices t set
    status          = v.status,
    amount_cents    = v.amount_cents,
    tax_cents       = v.tax_cents,
    line_items      = v.line_items,
    customer_note   = v.customer_note,
    sent_at         = v.sent_at,
    paid_at         = v.paid_at,
    qbo_sync_token  = v.qbo_sync_token,
    qbo_sync_status = 'synced',
    qbo_synced_at   = now(),
    updated_at      = now()
  from jsonb_to_recordset(p_rows) as v(
    id uuid,
    tenant_id uuid,
    status text,
    amount_cents bigint,
    tax_cents bigint,
    line_items jsonb,
    customer_note text,
    sent_at timestamptz,
    paid_at timestamptz,
    qbo_sync_token text
  )
  where t.id = v.id and t.tenant_id = v.tenant_id;
$$;

-- catalog_items. QBO is source of truth: refresh the full item content.
create or replace function public.qbo_bulk_update_catalog_items(p_rows jsonb)
returns void
language sql
as $$
  update public.catalog_items t set
    name             = v.name,
    description      = v.description,
    sku              = v.sku,
    pricing_model    = v.pricing_model,
    unit_label       = v.unit_label,
    unit_price_cents = v.unit_price_cents,
    is_taxable       = v.is_taxable,
    category         = v.category,
    is_active        = v.is_active,
    qbo_sync_token   = v.qbo_sync_token,
    qbo_sync_status  = 'synced',
    qbo_synced_at    = now(),
    updated_at       = now()
  from jsonb_to_recordset(p_rows) as v(
    id uuid,
    tenant_id uuid,
    name text,
    description text,
    sku text,
    pricing_model text,
    unit_label text,
    unit_price_cents bigint,
    is_taxable boolean,
    category text,
    is_active boolean,
    qbo_sync_token text
  )
  where t.id = v.id and t.tenant_id = v.tenant_id;
$$;

-- bills. QBO is source of truth: refresh the header. (Child bill_line_items
-- are replaced wholesale by the importer in a batched delete + insert, not
-- here.)
create or replace function public.qbo_bulk_update_bills(p_rows jsonb)
returns void
language sql
as $$
  update public.bills t set
    doc_number      = v.doc_number,
    txn_date        = v.txn_date,
    due_date        = v.due_date,
    subtotal_cents  = v.subtotal_cents,
    tax_cents       = v.tax_cents,
    total_cents     = v.total_cents,
    balance_cents   = v.balance_cents,
    status          = v.status,
    private_note    = v.private_note,
    qbo_class_id    = v.qbo_class_id,
    qbo_class_name  = v.qbo_class_name,
    qbo_sync_token  = v.qbo_sync_token,
    qbo_sync_status = 'synced',
    qbo_synced_at   = now(),
    updated_at      = now()
  from jsonb_to_recordset(p_rows) as v(
    id uuid,
    tenant_id uuid,
    doc_number text,
    txn_date date,
    due_date date,
    subtotal_cents bigint,
    tax_cents bigint,
    total_cents bigint,
    balance_cents bigint,
    status text,
    private_note text,
    qbo_class_id text,
    qbo_class_name text,
    qbo_sync_token text
  )
  where t.id = v.id and t.tenant_id = v.tenant_id;
$$;

-- project_costs (QBO Purchase → receipt-type cost). Refresh content; the
-- source_type='receipt' guard mirrors the importer's per-row update so a
-- bill / non-receipt cost is never touched.
create or replace function public.qbo_bulk_update_purchases(p_rows jsonb)
returns void
language sql
as $$
  update public.project_costs t set
    amount_cents    = v.amount_cents,
    vendor          = v.vendor,
    description     = v.description,
    cost_date       = v.cost_date,
    qbo_class_id    = v.qbo_class_id,
    qbo_class_name  = v.qbo_class_name,
    qbo_sync_token  = v.qbo_sync_token,
    qbo_sync_status = 'synced',
    qbo_synced_at   = now(),
    updated_at      = now()
  from jsonb_to_recordset(p_rows) as v(
    id uuid,
    tenant_id uuid,
    amount_cents bigint,
    vendor text,
    description text,
    cost_date date,
    qbo_class_id text,
    qbo_class_name text,
    qbo_sync_token text
  )
  where t.id = v.id and t.tenant_id = v.tenant_id and t.source_type = 'receipt';
$$;

-- Service-role only: these are called exclusively by the import worker's
-- admin client. Never expose to anon / authenticated.
revoke all on function public.qbo_bulk_update_contacts(jsonb)      from public;
revoke all on function public.qbo_bulk_update_invoices(jsonb)      from public;
revoke all on function public.qbo_bulk_update_catalog_items(jsonb) from public;
revoke all on function public.qbo_bulk_update_bills(jsonb)         from public;
revoke all on function public.qbo_bulk_update_purchases(jsonb)     from public;

grant execute on function public.qbo_bulk_update_contacts(jsonb)      to service_role;
grant execute on function public.qbo_bulk_update_invoices(jsonb)      to service_role;
grant execute on function public.qbo_bulk_update_catalog_items(jsonb) to service_role;
grant execute on function public.qbo_bulk_update_bills(jsonb)         to service_role;
grant execute on function public.qbo_bulk_update_purchases(jsonb)     to service_role;
