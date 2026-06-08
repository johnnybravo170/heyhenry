-- Lock down the QBO bulk-update functions to service_role ONLY.
--
-- The creating migration (20260529222054) did `revoke all ... from public`,
-- which is sufficient on a vanilla Postgres but NOT on Supabase: Supabase
-- ships `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS
-- TO anon, authenticated, service_role`, so a newly-created function gets
-- EXPLICIT anon/authenticated grants that a `revoke from public` leaves in
-- place. On prod the functions therefore came up executable by anon +
-- authenticated.
--
-- These are internal import-worker primitives (only the service-role admin
-- client calls them). Being SECURITY INVOKER, an authenticated user calling
-- e.g. qbo_bulk_update_invoices could overwrite their own tenant's row content
-- (status / amounts / line_items), bypassing app-layer validation. RLS keeps
-- it within-tenant, but it's still an unintended write surface. Revoke it.
--
-- Lesson for future service-role-only functions: revoke from
-- {public, anon, authenticated}, not just public.

revoke all on function public.qbo_bulk_update_contacts(jsonb)      from anon, authenticated;
revoke all on function public.qbo_bulk_update_invoices(jsonb)      from anon, authenticated;
revoke all on function public.qbo_bulk_update_catalog_items(jsonb) from anon, authenticated;
revoke all on function public.qbo_bulk_update_bills(jsonb)         from anon, authenticated;
revoke all on function public.qbo_bulk_update_purchases(jsonb)     from anon, authenticated;
