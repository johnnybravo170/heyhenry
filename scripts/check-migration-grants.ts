#!/usr/bin/env tsx
/**
 * Data API grant lint for new public tables.
 *
 * Since `20260527151331_optin_data_api_no_auto_grant`, this project no longer
 * auto-grants new `public`-schema tables to the Data API roles (anon /
 * authenticated / service_role). A new table with RLS policies but no base
 * GRANT returns permission-denied over PostgREST — the policy never even
 * evaluates, because RLS sits on top of table privileges. (A new root cause
 * for the familiar "silent RLS block" symptom; cf. migs 0091 / 0173.)
 *
 * This guard asserts that every `CREATE TABLE` in the `public` schema, in any
 * migration created AFTER the opt-in, also issues a `GRANT ... ON <table>` in
 * the same file. See AGENTS.md "Database migrations".
 *
 * Scope / deliberate limitations:
 *   - Only files with a 14-digit timestamp prefix strictly greater than the
 *     opt-in version are checked. Everything created before the opt-in kept
 *     its automatic grants (Supabase does not revoke them) — grandfathered.
 *   - Only the `public` schema is enforced. The opt-in revoked default
 *     privileges `in schema public` only; `ops.*` etc. live in a different
 *     default-privilege domain and already grant explicitly by convention.
 *   - Grant must be in the SAME migration as the CREATE TABLE (the convention).
 *     Splitting create + grant across files is not supported and will flag.
 *   - Comments and dollar-quoted function bodies are stripped before scanning,
 *     so `-- GRANT ...` in a comment doesn't satisfy the check and a dynamic
 *     `EXECUTE 'CREATE TABLE ...'` inside a function body doesn't trigger it.
 *
 * Exit codes:
 *   0 = every new public table is granted
 *   1 = at least one new public table has no matching GRANT
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');

// Tables created at/before this migration kept their automatic grants.
// Only enforce on migrations created strictly after the opt-in.
const OPTIN_VERSION = '20260527151331';

const TIMESTAMP_RE = /^(\d{14})_/;

/** Strip block comments, dollar-quoted bodies, then line comments. */
function stripNoise(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block comments */
    .replace(/\$([a-zA-Z_]*)\$[\s\S]*?\$\1\$/g, ' ') // $$ ... $$ / $tag$ ... $tag$
    .replace(/--[^\n]*/g, ' '); // -- line comments
}

/** Normalize a raw table ref ("public"."Foo" / public.foo / foo) to its
 *  bare lowercased table name, or null if it's in a non-public schema. */
function normalizeTableRef(raw: string): string | null {
  const cleaned = raw.replace(/["`()]/g, '').trim();
  if (!cleaned) return null;
  const parts = cleaned.split('.');
  if (parts.length === 1) return parts[0].toLowerCase(); // unqualified → public
  const [schema, table] = [parts[0].toLowerCase(), parts[parts.length - 1].toLowerCase()];
  return schema === 'public' ? table : null; // skip ops/auth/storage/etc.
}

/** Public tables created in this SQL. */
function createdPublicTables(sql: string): Set<string> {
  const out = new Set<string>();
  const re = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_."`]+)/gi;
  for (const m of sql.matchAll(re)) {
    const name = normalizeTableRef(m[1]);
    if (name) out.add(name);
  }
  return out;
}

/** Table names that appear as the object of a GRANT in this SQL. */
function grantedTables(sql: string): Set<string> {
  const out = new Set<string>();
  // GRANT <privs> ON [TABLE] <obj-list> TO <roles>
  const re = /\bgrant\b[\s\S]*?\bon\b\s+(?:table\s+)?([\s\S]*?)\bto\b/gi;
  for (const m of sql.matchAll(re)) {
    for (const item of m[1].split(',')) {
      const name = normalizeTableRef(item);
      if (name) out.add(name);
    }
  }
  return out;
}

function main(): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => {
      const m = f.match(TIMESTAMP_RE);
      return m !== null && m[1] > OPTIN_VERSION;
    })
    .sort();

  const violations: { file: string; tables: string[] }[] = [];

  for (const file of files) {
    const sql = stripNoise(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    const created = createdPublicTables(sql);
    if (created.size === 0) continue;
    const granted = grantedTables(sql);
    const missing = [...created].filter((t) => !granted.has(t));
    if (missing.length > 0) violations.push({ file, tables: missing });
  }

  if (violations.length > 0) {
    console.error('✗ new public tables created without a Data API GRANT:');
    for (const v of violations) {
      for (const t of v.tables) console.error(`  - ${v.file}: public.${t}`);
    }
    console.error('');
    console.error(
      'Since the no-auto-grant opt-in, a new public table is unreachable over the Data API until you grant it. RLS policies are NOT enough — they sit on top of table privileges.',
    );
    console.error('Add, in the same migration:');
    console.error('  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;');
    console.error('  GRANT ALL                            ON public.<table> TO service_role;');
    console.error('See AGENTS.md "Database migrations".');
    process.exit(1);
  }

  console.log(`✓ migration grants clean (${files.length} post-opt-in migration(s) checked)`);
}

main();
