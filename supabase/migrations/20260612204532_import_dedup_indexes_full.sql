-- Replace the partial import-dedup unique indexes with full unique indexes.
--
-- The import append routes upsert with PostgREST's
-- `onConflict: 'tenant_id,import_source_row_id'`, which emits
-- `ON CONFLICT (tenant_id, import_source_row_id)` WITHOUT the partial-index
-- predicate. Postgres cannot infer a partial unique index from a plain
-- column list, so every import upsert failed with "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification" — the
-- /api/import/project/:id/* endpoints could never insert.
--
-- A full unique index has identical semantics for our data: NULLs are
-- distinct (default NULLS DISTINCT), so the many non-import rows with
-- import_source_row_id IS NULL never conflict with each other.

DROP INDEX IF EXISTS public.uidx_time_entries_import_dedup;
CREATE UNIQUE INDEX uidx_time_entries_import_dedup
  ON public.time_entries (tenant_id, import_source_row_id);

DROP INDEX IF EXISTS public.uidx_project_costs_import_dedup;
CREATE UNIQUE INDEX uidx_project_costs_import_dedup
  ON public.project_costs (tenant_id, import_source_row_id);

DROP INDEX IF EXISTS public.uidx_invoices_import_dedup;
CREATE UNIQUE INDEX uidx_invoices_import_dedup
  ON public.invoices (tenant_id, import_source_row_id);

DROP INDEX IF EXISTS public.uidx_owner_draws_import_dedup;
CREATE UNIQUE INDEX uidx_owner_draws_import_dedup
  ON public.owner_draws (tenant_id, import_source_row_id);

DROP INDEX IF EXISTS public.uidx_change_orders_import_dedup;
CREATE UNIQUE INDEX uidx_change_orders_import_dedup
  ON public.change_orders (tenant_id, import_source_row_id);
