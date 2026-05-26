<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Match existing patterns

Read `PATTERNS.md` at the start of any UI or flow change. It catalogs reusable patterns (upload zones, customer pick-or-create, confirm dialogs, inline edits, status badges, empty states, tabs, server-action result shape).

When you change one instance of a pattern (e.g. add drag-drop to the logo uploader), evaluate every sibling instance listed in `PATTERNS.md` for the same family and **surface them to the user with a "should I update these too?" prompt**. Do not silently update siblings, and do not silently skip them. Let the user decide per-sibling.

When you introduce a new flow worth standardizing — or extract a one-off into a reusable component — update `PATTERNS.md` in the same change.

# Database migrations

**Always use timestamp-prefixed filenames for new migrations.** Format: `YYYYMMDDHHMMSS_short_name.sql` — 14 UTC digits, underscore, snake_case slug, `.sql`. Example: `20260507210400_photos_import_batch.sql`.

The legacy `NNNN_name.sql` 4-digit format still exists in the repo but **don't add new ones in that style**. The 4-digit scheme silently corrupts when two PRs claim the same number — Supabase's migration tracker keys on the prefix and only registers one of them; the other's SQL is recorded as "applied" but never runs. Phases ship live in code with no DB schema behind them, and the bug surfaces only when something tries to use the missing column. Both styles sort lexicographically so mixing them keeps the apply order intact forever.

`supabase migration new <slug>` (the official CLI) generates the timestamp format by default — use that, not a hand-typed prefix.

Two guards exist:
- `scripts/check-migration-prefixes.ts` runs in CI and fails on intra-tree duplicates.
- `.husky/pre-push` fetches `origin/main` and bails if a migration you're about to push collides with one already on remote (catches the rebase-and-forget case).

Both are bypassable (`git push --no-verify`); don't reach for the bypass casually — silent skips are exactly what these guards exist to prevent.

## Prod migrations apply automatically on merge to main

The `deploy-migrations` job in `.github/workflows/ci.yml` runs `supabase db push` against prod on every push to `main` (and on manual `workflow_dispatch`), gated behind `needs: [quality, e2e]` so schema never ships off a red main. You do **not** hand-apply migrations as a separate step anymore — merge the migration with its code and CI pushes it. The job is idempotent: it only applies versions missing from the remote `supabase_migrations.schema_migrations` ledger, and is a no-op when in sync.

Requires one GitHub repo secret (Settings → Secrets and variables → Actions):
- `SUPABASE_DB_URL` — the **session-mode pooler** connection string (port 5432, `...pooler.supabase.com`), same value as the app's `DATABASE_URL`. The job pushes via `--db-url` over the pooler on purpose: GitHub runners are IPv4-only and the direct db host is IPv6-only, so `supabase link` + a direct push would fail with "no route to host". Transaction mode (port 6543) won't work either — migrations need session-level advisory locks.

**Ordering caveat — migrations must be backward-compatible.** Vercel deploys code via its own native Git integration, in parallel with this job, so schema is **not** guaranteed to land before the new code goes live. Default to additive expand → migrate → contract across separate ships (see the `project_budget_sections_*` and `*_property_record` migrations for the pattern). A genuinely breaking change (table/column rename) must ship in the **same merge** as the code that depends on it and tolerate a few seconds' apply window — only do this on low-write surfaces.

If the ledger ever drifts from reality (a migration recorded but not applied, or vice-versa), the Supabase MCP is read-only on prod — reconcile via the Management API SQL endpoint, then `insert ... into supabase_migrations.schema_migrations (version, name) on conflict do nothing`. Verify a migration's *effects* directly (`information_schema` / `pg_proc`); presence in the ledger is not proof it ran.

# Timezones

The runtime tz on Vercel is UTC. Bare `Date.toLocaleDateString(...)` / `toLocaleTimeString(...)` / `new Intl.DateTimeFormat(...)` without a `timeZone:` arg formats in UTC and silently shifts dates for any user not in UTC. Always render dates in the contractor's tenant tz.

- **Server code:** call `formatDate(iso, { timezone })` from `src/lib/date/format.ts` (tenant tz lives on `tenant.timezone` from `getCurrentTenant()`).
- **Client code:** call `useTenantTimezone()` from `src/lib/auth/tenant-context.tsx` — the dashboard, worker, and public-portal layouts wrap children in `<TenantProvider>`.
- **AI tool handlers:** module-level state set via `setToolTimezone(tenant.timezone)` in `src/app/api/henry/tool/route.ts` — already wired up; new tool formatters go through the existing pattern.

`tests/unit/timezone-no-bare-tolocale.test.ts` blocks bare `toLocale*` and bare `new Intl.DateTimeFormat(...)` calls in CI. See PATTERNS.md §23 for the full convention including adjacent gotchas (`Date.getHours()`, `Date.toLocaleString` on Dates) the lint rule doesn't catch.

# QA tenants

Two designated QA / demo tenants on production, one per vertical — both flagged
`tenants.is_demo = true` (suppresses outbound email + SMS, excluded from
platform metrics). **Match the tenant to the feature's vertical:**
- **Overflow Test Co** (`7098bd96-9cdd-47af-a412-3679af4cb536`, `pressure_washing`) — login, dashboards, worker/bookkeeper layouts, send flows.
- **Maple Ridge Renos** (`a5925193-fedb-4164-bd7c-91122f6e1ef3`, `renovation`) — GC surfaces (Project Hub, Budget, Spend, Labour, Billing). Has a seeded project with a populated budget; Overflow has none. Re-seed via `node scripts/setup-gc-demo-tenant.mjs`.

Logins + the full convention are in `docs/qa-tenant.md`; shared passwords are
in the ops knowledge vault.

Any new cross-tenant aggregate query must exclude demo tenants — see
`src/lib/tenants/demo.ts`.

# Working in a worktree

Worktrees under `.claude/worktrees/<name>/` start without gitignored config files (`.env.local`, `.env.sentry-build-plugin`), so `pnpm dev` boots but every server-rendered route throws on Supabase init. Before doing anything else in a new worktree:

```
bash scripts/setup-worktree.sh
pnpm install   # if node_modules is empty
```

`scripts/setup-worktree.sh` symlinks the env files from the main checkout (always the first entry in `git worktree list`). Idempotent — re-run any time. When you rotate secrets in main, every worktree picks it up for free. If the dev server still complains about a missing env var after running it, that file isn't in the script's `FILES` list yet — add it there, not in a one-off symlink.
