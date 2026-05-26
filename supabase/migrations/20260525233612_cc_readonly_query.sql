-- 20260525233612_cc_readonly_query.sql
-- Read-only DB grounding for the HeyHenry Command Center routine (admin surface).
--
-- The Command Center grounds recommendations in live platform state
-- (e.g. "how many tenants on plan X", "is this already adopted") via the ops
-- MCP (the admin surface, per the voice-vs-admin split), through one
-- admin_sql_read tool.
--
-- Safety model (defense in depth):
--   1. A dedicated NOLOGIN role cc_readonly with NO write privileges and NO
--      raw-table grants. It can only SELECT curated ops.cc_* views.
--   2. Those views are owned by the migration role, so they bypass RLS by
--      ownership and expose ONLY non-PII / aggregate columns. The role never
--      touches base tables, so tenant PII is structurally absent.
--   3. Every query runs through ops.cc_readonly_query, a SECURITY DEFINER
--      function that drops to cc_readonly, locks search_path, forces a READ
--      ONLY transaction, sets a statement_timeout, and wraps the query as a
--      subquery (so a write/DDL or multi-statement payload cannot execute).
--
-- Extending the allowlist: add an ops.cc_<name> view exposing the non-PII
-- slice, then GRANT SELECT ON ops.cc_<name> TO cc_readonly. Never grant
-- cc_readonly SELECT on a base table directly; keep curation in the views.

-- ============================================================
-- Role
-- ============================================================
DO $ccrole$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cc_readonly') THEN
    CREATE ROLE cc_readonly NOLOGIN NOINHERIT;
  END IF;
END
$ccrole$;

-- The SECURITY DEFINER function (owned by the migration role) must be able to
-- SET ROLE cc_readonly; membership grants that.
GRANT cc_readonly TO CURRENT_USER;

-- Schema visibility only. No blanket table grants.
GRANT USAGE ON SCHEMA ops TO cc_readonly;
GRANT USAGE ON SCHEMA public TO cc_readonly;

-- ============================================================
-- Curated, non-PII view #1: tenant summary
-- ============================================================
-- Excludes name/slug/address/phone/email/stripe/qbo columns. Exposes only the
-- dimensions useful for grounding (by plan / vertical / region / status).
CREATE OR REPLACE VIEW ops.cc_tenants AS
SELECT
  id,
  vertical,
  secondary_verticals,
  region,
  province,
  country,
  plan,
  subscription_status,
  founding_member,
  is_demo,
  trial_ends_at,
  current_period_end,
  created_at,
  deleted_at
FROM public.tenants;

GRANT SELECT ON ops.cc_tenants TO cc_readonly;

COMMENT ON VIEW ops.cc_tenants IS
  'Command Center grounding: non-PII tenant dimensions (plan/vertical/region/status). No name/contact/address/payment columns. Read by cc_readonly via admin_sql_read.';

-- ============================================================
-- Sandboxed read-only query function
-- ============================================================
CREATE OR REPLACE FUNCTION ops.cc_readonly_query(q text, max_rows int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $ccfn$
DECLARE
  result jsonb;
  capped int := least(greatest(coalesce(max_rows, 200), 1), 1000);
BEGIN
  -- Drop privileges to the curated read-only role, lock search_path (so this
  -- SECURITY DEFINER function is injection-safe and the dynamic query must
  -- schema-qualify), and forbid any write at the transaction level.
  SET LOCAL ROLE cc_readonly;
  SET LOCAL search_path = pg_catalog;
  SET LOCAL default_transaction_read_only = on;
  SET LOCAL statement_timeout = '5s';

  -- Wrapping q as a subquery forces a single SELECT: a semicolon, second
  -- statement, or DDL inside parentheses is a syntax error, and the read-only
  -- role plus transaction block anything that slips through.
  EXECUTE format(
    'SELECT jsonb_agg(t) FROM (SELECT * FROM (%s) _q LIMIT %s) t',
    q, capped
  ) INTO result;

  RETURN coalesce(result, '[]'::jsonb);
END
$ccfn$;

-- Only the ops app service role may invoke it (it then enforces the read:db
-- MCP scope on top). Never expose to anon/authenticated.
REVOKE ALL ON FUNCTION ops.cc_readonly_query(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ops.cc_readonly_query(text, int) TO service_role;

COMMENT ON FUNCTION ops.cc_readonly_query(text, int) IS
  'Runs a single SELECT as the cc_readonly role in a READ ONLY transaction (5s timeout, row cap). Backs admin_sql_read. q must schema-qualify and reference only relations cc_readonly can SELECT (ops.cc_* views).';
