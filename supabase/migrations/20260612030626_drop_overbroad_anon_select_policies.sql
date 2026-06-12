-- Drop orphaned anon-role SELECT policies that exposed cross-tenant rows.
--
-- Each of these RLS policies granted the public `anon` role (the anon key
-- that ships in the browser bundle) SELECT on a whole CLASS of rows rather
-- than the single row matching a supplied secret:
--
--   anon_select_worker_invites          USING (used_at IS NULL AND ... )
--   anon_select_change_orders_by_code   USING (approval_code IS NOT NULL)
--   anon_select_change_order_lines_by_co USING (change_order_id IN (... approval_code IS NOT NULL))
--   anon_select_project_decisions_by_code USING (approval_code IS NOT NULL)
--   anon_select_projects_portal         USING (portal_enabled = true AND ...)
--   anon_select_portal_updates          USING (EXISTS portal-enabled project AND is_visible)
--   anon_select_property_records_by_slug USING (slug IS NOT NULL)
--   anon_select_active_referral_codes   USING (is_active = true)
--
-- Because the qualifier never references the caller-supplied code/slug, any
-- holder of the public anon key could read every such row across ALL tenants
-- via PostgREST (e.g. GET /rest/v1/worker_invites?select=code,tenant_id,role)
-- and harvest the secret join/approval codes plus customer PII. The leaked
-- codes then drive legitimate write surfaces (join a tenant as worker/
-- bookkeeper; approve a change order or estimate).
--
-- The application never depended on anon-role reads: every public surface
-- (/approve, /estimate, /decide, /portal, /property-record, the worker-invite
-- join page, and the referral landing) fetches server-side through the
-- service-role admin client with an exact `.eq(<code|slug>, value)` filter
-- (verified in approve/estimate/decide/portal/property-record page.tsx,
-- worker-invites.ts:findWorkerInviteByCode, referrals.ts:findReferralCodeByCode).
-- Dropping these policies removes anon read access with zero functional change.
-- The authenticated / tenant policies on each table are untouched, so RLS
-- still scopes every logged-in caller to their own tenant.

DROP POLICY IF EXISTS anon_select_worker_invites ON public.worker_invites;
DROP POLICY IF EXISTS anon_select_change_orders_by_code ON public.change_orders;
DROP POLICY IF EXISTS anon_select_change_order_lines_by_co ON public.change_order_lines;
DROP POLICY IF EXISTS anon_select_project_decisions_by_code ON public.project_decisions;
DROP POLICY IF EXISTS anon_select_projects_portal ON public.projects;
DROP POLICY IF EXISTS anon_select_portal_updates ON public.project_portal_updates;
DROP POLICY IF EXISTS anon_select_property_records_by_slug ON public.property_records;
DROP POLICY IF EXISTS anon_select_active_referral_codes ON public.referral_codes;
