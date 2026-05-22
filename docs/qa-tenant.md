# QA tenants

Two designated QA / demo tenants on **production**, one per vertical. Use them
for manual click-through testing — login flows, dashboards, the worker and
bookkeeper layouts, sending estimates/invoices, etc.

**Pick the tenant that matches the feature's vertical.** Overflow Test Co is
`pressure_washing` and has NO projects/budgets/change-orders — so it can't
exercise the GC surfaces (Project Hub, Budget, Spend, Labour, Billing). For
GC / renovation features, use **Maple Ridge Renos**.

## Overflow Test Co (pressure_washing)

`7098bd96-9cdd-47af-a412-3679af4cb536`, `pressure_washing` vertical.

| Role | Login | Lands on |
|---|---|---|
| owner | `overflowtest@example.com` | `/dashboard` |
| worker | `overflowtest+worker@example.com` | `/w` |
| bookkeeper | `overflowtest+bookkeeper@example.com` | `/bk` |

## Maple Ridge Renos (renovation / GC)

`a5925193-fedb-4164-bd7c-91122f6e1ef3`, `vertical='renovation'`. Seeded with a
real project (**Maple Heights Full Home Reno**, active/approved) carrying 3
budget sections · 8 categories · cost lines · realized spend (Framing is
deliberately over budget) — so the Budget tab and other GC surfaces render
populated.

| Role | Login | Lands on |
|---|---|---|
| owner | `gcdemo@example.com` | `/dashboard` |
| worker | `gcdemo+worker@example.com` | `/w` |

Set up / re-seed with `node scripts/setup-gc-demo-tenant.mjs` (idempotent).

Shared passwords are in the ops knowledge vault (search "QA tenant credentials").
Not real secrets — both tenants are inert (see below) — but kept out of the repo.

## What `is_demo` does

The tenant has `tenants.is_demo = true`. That flag is load-bearing — see
`src/lib/tenants/demo.ts`:

- **Outbound email + SMS is suppressed.** `sendEmail()` and `sendSms()` still
  write the audit row (`email_send_log` / `twilio_messages`) but with
  `status = 'suppressed_demo'` and never call Postmark / Twilio. Test invoices,
  estimates, and change-order notifications can't reach real inboxes or phones.
  To verify what *would* have sent, read the audit row.
- **Excluded from platform metrics.** `src/lib/db/queries/admin.ts` and
  `src/lib/db/queries/platform-metrics.ts` filter demo tenants out of every
  cross-tenant aggregate (signups, revenue, active tenants, SMS counts, etc.).
  The admin tenant *list* still shows it, badged "QA / demo".

Any new cross-tenant aggregate query MUST exclude demo tenants — use
`getDemoTenantIds()` / `demoExclusionList()` from `src/lib/tenants/demo.ts`,
or filter `is_demo` directly when querying the `tenants` table.

> Not covered: ops-side digests/rollups live in a separate repo and read prod
> directly. They should filter on `tenants.is_demo` too — tracked separately.

## Re-running setup

Both scripts are idempotent:

```
set -a && source .env.local && set +a
node scripts/setup-qa-tenant.mjs              # is_demo flag, password reset, worker+bookkeeper members
pnpm tsx scripts/seed-test-data.ts --email overflowtest@example.com [--reset]
```

`setup-qa-tenant.mjs` configures the tenant + members. `seed-test-data.ts`
fills it with customers / quotes / jobs / invoices (`--reset` wipes data
first, keeps the tenant + members).
