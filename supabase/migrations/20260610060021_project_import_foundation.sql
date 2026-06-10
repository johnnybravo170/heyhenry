-- project_import_foundation
--
-- 1. Make time_entries.user_id nullable so the service-role import path
--    can insert entries without a signed-in user. The import endpoint uses
--    the admin client (RLS bypassed); read policies already gate workers to
--    rows where user_id = auth.uid(), so NULL rows are owner/admin-visible
--    only — correct until ghost workers land and link via worker_profile_id.
ALTER TABLE public.time_entries
  ALTER COLUMN user_id DROP NOT NULL;

-- Same rationale for expenses: the import path has no signed-in user.
ALTER TABLE public.expenses
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add import_source_row_id to every append-target table.
--    Per-table column approach: simpler than a central ledger, no extra join.
--    Partial unique indexes enforce one DB row per source row per tenant.
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS import_source_row_id TEXT;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS import_source_row_id TEXT;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS import_source_row_id TEXT;

ALTER TABLE public.owner_draws
  ADD COLUMN IF NOT EXISTS import_source_row_id TEXT;

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS import_source_row_id TEXT;

-- Partial unique indexes: a given source_row_id can only map to one DB row
-- per tenant. NULL rows are excluded so normal (non-import) rows are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_time_entries_import_dedup
  ON public.time_entries (tenant_id, import_source_row_id)
  WHERE import_source_row_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_expenses_import_dedup
  ON public.expenses (tenant_id, import_source_row_id)
  WHERE import_source_row_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_invoices_import_dedup
  ON public.invoices (tenant_id, import_source_row_id)
  WHERE import_source_row_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_owner_draws_import_dedup
  ON public.owner_draws (tenant_id, import_source_row_id)
  WHERE import_source_row_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_change_orders_import_dedup
  ON public.change_orders (tenant_id, import_source_row_id)
  WHERE import_source_row_id IS NOT NULL;
