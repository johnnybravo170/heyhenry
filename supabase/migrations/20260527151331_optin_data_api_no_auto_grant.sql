-- Opt in EARLY to Supabase's "no automatic Data API grants" behavior.
--
-- Background: Supabase is removing the default privileges that automatically
-- grant new public-schema tables to anon / authenticated / service_role over
-- the Data API (PostgREST). New projects get this default on 2026-05-30;
-- existing projects (us) are force-enforced on 2026-10-30. We adopt it now to
-- surface gaps during the runway rather than getting surprised in October.
--   Ref: https://github.com/orgs/supabase/discussions/45329
--
-- FORWARD-ONLY by construction — this does NOT touch any existing table:
--   * `ALTER DEFAULT PRIVILEGES` only affects objects created AFTER it runs.
--   * This migration sits at the HEAD of the tree, so on a fresh `db reset` /
--     `supabase start` rebuild, every existing table is created (with the old
--     auto-grants still in effect) BEFORE this runs. On prod, existing tables
--     keep their current grants — nothing is revoked. Only tables created by
--     FUTURE migrations are governed by the new default.
--
-- CONSEQUENCE (now enforced going forward): every new public-schema table must
-- issue its own grants alongside its RLS block, e.g.
--     GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
--     GRANT ALL                            ON public.<table> TO service_role;
-- Otherwise authenticated reads return permission-denied even with correct
-- policies — RLS sits on top of table privileges, so the policy never even
-- evaluates. (This is a new root cause for our familiar "silent RLS block"
-- symptom; cf. migs 0091 and 0173.) See the AGENTS.md "Database migrations"
-- convention + the ops knowledge doc "Supabase Data API grants now REQUIRED on
-- new public tables".

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
