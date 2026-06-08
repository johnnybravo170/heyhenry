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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cc_readonly') THEN
    CREATE ROLE cc_readonly NOLOGIN NOINHERIT;
  END IF;
END
$$;

-- The SECURITY DEFINER function (owned by postgres) must be able to
-- SET ROLE cc_readonly; membership grants that. NB: grant to the explicit
-- role name, not CURRENT_USER/SESSION_USER — the Supabase CLI migration
-- splitter chokes on the keyword-grantee form of GRANT ROLE ("unexpected EOF").
GRANT cc_readonly TO postgres;

-- Schema visibility only. No blanket table grants. CREATE on ops is required
-- for cc_readonly to OWN the query function below (Postgres requires an
-- object's owner to hold CREATE on its schema); it's inert otherwise — the
-- role is NOLOGIN and only reachable through the read-only definer function.
GRANT USAGE, CREATE ON SCHEMA ops TO cc_readonly;
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
AS $$
DECLARE
  result jsonb;
  capped int := least(greatest(coalesce(max_rows, 200), 1), 1000);
BEGIN
  -- This function is OWNED BY cc_readonly (see ALTER below), so SECURITY
  -- DEFINER runs it with cc_readonly's privileges: it can only SELECT the
  -- curated ops.cc_* views and has no write grants. (Postgres forbids SET ROLE
  -- inside a SECURITY DEFINER function, so we drop privileges via ownership,
  -- not SET ROLE.) Lock search_path so the dynamic query must schema-qualify,
  -- and forbid writes at the transaction level as belt-and-suspenders.
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
$$;

-- Own the function with the curated read-only role so SECURITY DEFINER runs it
-- with exactly cc_readonly's (SELECT-only, cc_* views) privileges.
ALTER FUNCTION ops.cc_readonly_query(text, int) OWNER TO cc_readonly;

-- Only the ops app service role may invoke it (it then enforces the read:db
-- MCP scope on top). Never expose to anon/authenticated.
REVOKE ALL ON FUNCTION ops.cc_readonly_query(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ops.cc_readonly_query(text, int) TO service_role;

COMMENT ON FUNCTION ops.cc_readonly_query(text, int) IS
  'Runs a single SELECT as the cc_readonly role in a READ ONLY transaction (5s timeout, row cap). Backs admin_sql_read. q must schema-qualify and reference only relations cc_readonly can SELECT (ops.cc_* views).';
