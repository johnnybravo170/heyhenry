#!/usr/bin/env tsx
/**
 * Ops `key_id` foreign-key lint.
 *
 * On every `ops.*` table, the `key_id` / `created_by_key_id` actor-attribution
 * column is POLYMORPHIC: it holds the id of whichever identity authenticated
 * the write — either an `ops.api_keys.id` (HMAC api-key path) OR an
 * `ops.oauth_tokens.id` (OAuth path, used by Claude Code Routines hitting
 * `/api/mcp`). The canonical precedent is `ops.audit_log.key_id`, which
 * deliberately carries NO foreign key for exactly this reason.
 *
 * A single-target FK `key_id -> ops.api_keys(id)` looks correct but silently
 * bricks every OAuth-authed insert: the MCP route stamps `ctx.keyId =
 * auth.token.id` (an `oauth_tokens` UUID, absent from `api_keys`), so any
 * INSERT that writes `key_id` fails `..._key_id_fkey`. It hides well — audit
 * logging still works (no FK there) and update paths that don't re-stamp
 * `key_id` still work, so only brand-new inserts 500.
 *
 * This trap has shipped TWICE: `0094_drop_ops_key_id_fks` removed it from
 * every ops table existing then, but 5 tables created afterward re-copied the
 * FK'd template (board_sessions, decision_bundles, idea_outcomes,
 * message_evals, scout_policy) — and decision_bundles silently dropped every
 * Command Center queue insert for 8 days. Fixed in
 * `20260603153851_drop_remaining_ops_key_id_fks`. This guard exists so a 6th
 * table can never reintroduce it.
 *
 * The rule: a new ops `key_id`-family column stays FK-free (soft pointer),
 * matching `audit_log`. See AGENTS.md and the ops knowledge note
 * "ops resource tables: key_id is polymorphic".
 *
 * Scope / deliberate limitations:
 *   - Forward-only. Only files with a 14-digit timestamp prefix strictly
 *     greater than the fix migration are checked; the historical FK-adding
 *     migrations and all 4-digit legacy files are grandfathered (the FKs they
 *     added have already been dropped — re-flagging them would just wedge CI).
 *   - Comments and dollar-quoted function bodies are stripped before scanning.
 *
 * Exit codes:
 *   0 = no new ops key_id -> api_keys foreign key
 *   1 = at least one new migration adds the forbidden FK
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');

// The migration that dropped the last of these FKs. Only enforce on migrations
// created strictly after it; everything at/before is grandfathered.
const FIX_VERSION = '20260603153851';

const TIMESTAMP_RE = /^(\d{14})_/;

/** Strip block comments, dollar-quoted bodies, then line comments. */
function stripNoise(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block comments */
    .replace(/\$([a-zA-Z_]*)\$[\s\S]*?\$\1\$/g, ' ') // $$ ... $$ / $tag$ ... $tag$
    .replace(/--[^\n]*/g, ' '); // -- line comments
}

// A reference to ops.api_keys, tolerating quotes/whitespace and an optional
// (or bare) schema qualifier: ops.api_keys | "ops"."api_keys" | api_keys.
const API_KEYS_REF = String.raw`references\s+(?:"?ops"?\s*\.\s*)?"?api_keys"?`;

// Inline column FK:  <...>key_id uuid [not null] references ops.api_keys(id)
// The [^,;()] guard keeps the match inside a single column definition.
const INLINE_FK = new RegExp(
  String.raw`\b([a-z_]*key_id)\b[^,;()]*?\b${API_KEYS_REF}`,
  'gi',
);

// Table / ALTER constraint FK:  foreign key (key_id) references ops.api_keys
const CONSTRAINT_FK = new RegExp(
  String.raw`\bforeign\s+key\s*\(\s*"?([a-z_]*key_id)"?\s*\)\s*${API_KEYS_REF}`,
  'gi',
);

/** Columns in this SQL that FK a key_id-family column to ops.api_keys. */
function offendingColumns(sql: string): Set<string> {
  const out = new Set<string>();
  for (const m of sql.matchAll(INLINE_FK)) out.add(m[1].toLowerCase());
  for (const m of sql.matchAll(CONSTRAINT_FK)) out.add(m[1].toLowerCase());
  return out;
}

function main(): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => {
      const m = f.match(TIMESTAMP_RE);
      return m !== null && m[1] > FIX_VERSION;
    })
    .sort();

  const violations: { file: string; columns: string[] }[] = [];

  for (const file of files) {
    const sql = stripNoise(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    const cols = offendingColumns(sql);
    if (cols.size > 0) violations.push({ file, columns: [...cols] });
  }

  if (violations.length > 0) {
    console.error('✗ new migration adds a forbidden key_id → ops.api_keys foreign key:');
    for (const v of violations) {
      for (const c of v.columns) console.error(`  - ${v.file}: ${c} REFERENCES ops.api_keys`);
    }
    console.error('');
    console.error(
      'ops key_id / created_by_key_id is polymorphic — it holds an ops.api_keys.id OR an',
    );
    console.error(
      'ops.oauth_tokens.id (OAuth/MCP path). A single-target FK to ops.api_keys silently',
    );
    console.error(
      "500s every OAuth-authed insert (the token id isn't in api_keys). Leave the column",
    );
    console.error('FK-free, like ops.audit_log.key_id. See AGENTS.md and the ops knowledge note');
    console.error('"ops resource tables: key_id is polymorphic".');
    process.exit(1);
  }

  console.log(`✓ ops key_id FK lint clean (${files.length} post-fix migration(s) checked)`);
}

main();
