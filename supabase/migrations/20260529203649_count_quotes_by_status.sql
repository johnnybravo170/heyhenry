-- ============================================================
-- count_quotes_by_status(): tenant-scoped status tally for the
-- quotes list filter chips.
--
-- Replaces a query that selected `status` for every non-deleted
-- quote and tallied in JS (one row transferred per quote, just to
-- produce <=6 counts). This RPC does a single GROUP BY aggregate
-- scan and returns at most one row per distinct status.
--
-- The existing quotes_tenant_status_idx ON public.quotes
-- (tenant_id, status) (see 0017_indexes.sql) covers this: the
-- aggregate is an index-only scan over the tenant's slice, no
-- heap fetch for the count.
--
-- SECURITY DEFINER + explicit tenant filter: matches the
-- current_tenant_id() scoping convention (0003_current_tenant_fn.sql).
-- The function only ever reads the caller's own tenant rows, so
-- bypassing RLS here is safe and avoids per-row policy evaluation.
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_quotes_by_status()
RETURNS TABLE (
  status text,
  count  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.status::text, count(*)::bigint
  FROM public.quotes q
  WHERE q.tenant_id = public.current_tenant_id()
    AND q.deleted_at IS NULL
  GROUP BY q.status;
$$;

GRANT EXECUTE ON FUNCTION public.count_quotes_by_status() TO authenticated;

COMMENT ON FUNCTION public.count_quotes_by_status() IS
  'Tenant-scoped quote status tally (status, count) for the quotes list filter chips. Single GROUP BY aggregate over quotes_tenant_status_idx instead of transferring one row per quote. SECURITY DEFINER with an explicit current_tenant_id() filter.';
