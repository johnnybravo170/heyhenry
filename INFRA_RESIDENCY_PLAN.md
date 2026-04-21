# Infra Residency + Multi-Region Runbook

**Date:** 2026-04-21
**Status:** App-layer forward-compat shipped. Infra stand-up deferred until first non-CA customer.

---

## What's in place (2026-04-21)

- **`tenants.region`** — `NOT NULL DEFAULT 'ca-central-1'` with CHECK constraint. Migration `0060_tenants_region.sql`.
- **Provider abstraction** — `src/lib/providers/` with:
  - `PaymentProvider`, `TaxProvider`, `PayrollProvider` interfaces
  - `StripeConnectPaymentProvider` (only payment impl; lives per region)
  - `CanadianTaxProvider` (only tax impl; uses `tenants.gst_rate` + `pst_rate`)
  - `getPaymentProvider(tenantId)` / `getPaymentProviderForRegion(region)` / `getTaxProvider(tenantId)` factories
- **`provider_credentials`** — region-scoped credential storage. Service-role-only. Migration `0061_provider_credentials.sql`. Resolver at `src/lib/providers/secrets.ts` falls back to env vars so nothing breaks during rollout.
- **Call sites migrated** — all 5 Stripe API calls now go through `PaymentProvider`. No remaining `import Stripe` outside `src/lib/providers/payments/stripe-connect.ts`.

## Ground rules going forward

1. **No new `import Stripe` outside `src/lib/providers/`.** All new payment/tax/payroll code goes through the factory.
2. **Tax computation scattered across quote/invoice code is still using `gst_rate`/`pst_rate` directly.** Migrate opportunistically when touching those files. Not a today-problem.
3. **Env vars still work.** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` remain valid. Prefer adding to `provider_credentials` once credentials rotate.

---

## When the first non-CA customer signs up

Trigger: US or other non-Canadian tenant created, OR a compliance requirement names a specific region.

### Step 1 — Stand up the second Supabase project

- Create Supabase project in target region (e.g. `us-east-1`).
- Run **every** migration in `supabase/migrations/` against the new project.
- Add deploy pipeline: `supabase db push` targets both projects. Consider a `scripts/push-all-regions.sh`.
- Rotate migration naming to avoid drift: continue monotonic numbering across both projects.

### Step 2 — Region-aware DB clients

Current code: `src/lib/supabase/{server,admin,client}.ts` each instantiate a single client from env vars.

Changes needed:
- `createAdminClient(region?: Region)` — loads URL + service key for that region. Region defaults to `'ca-central-1'` until all call sites are audited, then becomes required.
- `createClient()` (server, user-scoped) — resolves region from the authenticated user's tenant, connects to that region's project.
- Middleware: reject cross-region requests with a 403 when a user from region A tries to read tenant data in region B.

Estimate: 1.5 days including audit of ~50 DB call sites.

### Step 3 — Widen region CHECK + seed credentials

- `ALTER TABLE tenants DROP CONSTRAINT tenants_region_check, ADD CONSTRAINT tenants_region_check CHECK (region IN ('ca-central-1', 'us-east-1'));`
- Insert `provider_credentials` rows for the new region's Stripe account, webhook secret, tax provider keys, etc.
- Verify `StripeConnectPaymentProvider` picks up the new region's keys via the secrets resolver.

### Step 4 — Routing at the request layer

- New users land on a region selector at signup (or Cloudflare/Vercel geo-routes to a region-specific signup URL).
- `tenants.region` set at signup, immutable thereafter (moving a tenant between regions = data export + reimport, not a column update).
- Auth session tokens include region; middleware rejects mismatches.

### Step 5 — Cross-region platform admin

Today `/admin/*` reads the single DB. Once regions multiply:
- Admin queries fan out across all regions and aggregate in-memory, OR
- A central warehouse (BigQuery/DuckDB) ETLs nightly from each region and admin reads warehouse.

Recommendation: start with fan-out; cut over to warehouse when admin latency becomes a problem.

### Step 6 — Per-tenant provider overrides

If, say, a Canadian tenant wants Helcim instead of Stripe:
- New table `tenant_provider_overrides (tenant_id, provider_type, provider_name, credentials_ref)`.
- Factory checks this table first, falls back to region default.
- Ship alongside the second payment impl, not before.

---

## What we consciously DID NOT do today

1. **Second Supabase project.** Empty DB with deploy friction for months = cost without benefit. Stand up on demand.
2. **Cross-region federation / ETL.** Nothing to federate.
3. **Region-aware DB client layer.** All calls go to `ca-central-1` implicitly. Adding the region arg is mechanical once there's a second project.
4. **Per-tenant provider overrides.** Designed above; coded when the second payment impl exists.
5. **Full tax provider refactor.** `gst_rate`/`pst_rate` still read directly from quote/invoice code. New code uses `getTaxProvider()`; existing code migrates when touched.

---

## Estimated cost when we need to execute this

| Step | Estimate | Blocking? |
|---|---|---|
| 1. Stand up second Supabase project | 0.5 day | Yes |
| 2. Region-aware DB clients | 1.5 days | Yes |
| 3. Widen CHECK + seed credentials | 0.25 day | Yes |
| 4. Routing | 0.5 day | Yes |
| 5. Cross-region admin (fan-out) | 1 day | No — can ship with admin temporarily single-region |
| 6. Per-tenant overrides | 0.5 day | No — only when second payment impl lands |

**Total blocking work:** ~3 days. Can be done in a single focused sprint once the first US customer is imminent.
