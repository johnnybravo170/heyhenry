# Autoresponder (AR) — Build Notes
<!-- STATUS: Phase 1 ✅ DONE | Phase 2 (MCP tools) ✅ DONE | Phase 3 (Admin UI /admin/ar/*) ❌ NOT STARTED -->

Built 2026-04-18. Platform-admin autoresponder for Hey Henry's own marketing
(leads, onboarding, nurture). Multi-tenant-ready schema; Phase 1 UI surfaces
platform scope only.

## What's in

- DB schema + RLS: `supabase/migrations/0040_autoresponder.sql`
- Drizzle models: `src/lib/db/schema/ar/`
- Policy engine (suppression, quiet hours, frequency cap): `src/lib/ar/policy.ts`
- Step executor: `src/lib/ar/executor.ts`
- Merge-tag renderer: `src/lib/ar/render.ts`
- Cron entry: `src/app/api/ar/cron/route.ts` (scheduled in `vercel.json`)
- Postmark webhook receiver: `src/app/api/ar/webhooks/postmark/route.ts` (token-authed via `POSTMARK_OUTBOUND_WEBHOOK_TOKEN` query param; handles Delivery / Bounce / SpamComplaint / Open / Click `RecordType`s)
- (legacy) Svix signature verifier: `src/lib/ar/webhook-verify.ts` — from the Resend era; the Postmark receiver uses query-param token auth instead, so this is currently unused
- Unsubscribe route: `src/app/unsubscribe/[token]/route.ts`
- Signed unsub tokens: `src/lib/ar/unsub-token.ts`

## What's not in Phase 1

- Admin UI (`/admin/ar/*`) — Phase 3
- ~~MCP tools — Phase 2~~ ✅ done (see below)
- React Flow visual builder — Phase 4
- Branch-step evaluation (currently a no-op passthrough)
- AWeber import

## Phase 2 — MCP Tools (2026-04-18)

12 tools under `mcp/src/tools/ar-{contacts,templates,sequences}.ts`:

**Contacts:** `ar_list_contacts`, `ar_upsert_contact`, `ar_tag_contact`, `ar_enroll_contact`
**Templates:** `ar_list_templates`, `ar_get_template`, `ar_upsert_template`
**Sequences:** `ar_list_sequences`, `ar_get_sequence`, `ar_create_sequence`, `ar_set_sequence_steps`, `ar_set_sequence_status`

### Scope config

The MCP server auto-picks scope from env:
- `SMARTFUSION_AR_PLATFORM=1` → AR tools use platform scope (tenant_id NULL)
- unset → AR tools use `SMARTFUSION_TENANT_ID`

When `AR_PLATFORM=1` AND `TENANT_ID` is unset, only AR tools register. Useful
for Jonathan's Claude Desktop config to manage Hey Henry's own marketing list
without needing to impersonate a tenant.

### Versioning

`ar_set_sequence_steps` bumps the sequence's version, inserts all new steps at
that version, and leaves old versions intact. Active enrollments keep their
pinned version, new enrollments get the new one.

### Smoke test

`mcp/test-ar-tools.ts` — boots the server, walks the full happy path
(template → sequence → steps → activate → contact → tag → enroll → verify).
Passes against local Supabase.

## Environment variables to set

| Var | Where | Purpose |
|---|---|---|
| `POSTMARK_SERVER_TOKEN` | already present | send email |
| `POSTMARK_FROM_EMAIL_MARKETING` | set to `HeyHenry <newsletters@send.heyhenry.io>` | default marketing from (AR sends route to the `outbound-marketing` stream) |
| `POSTMARK_OUTBOUND_WEBHOOK_TOKEN` | new — random 32+ char string, matched against the `?token=` query param | auth the Postmark event webhook |
| `CRON_SECRET` | new — random 32+ char string | auth the cron endpoint |
| `AR_UNSUB_SECRET` | new — random 32+ char string | sign unsub tokens |
| `AR_PUBLIC_BASE_URL` | new — `https://app.heyhenry.io` | for building unsub links |

## Postmark domain / DKIM setup

Split transactional (invoices, quotes) from marketing so deliverability issues
on one don't poison the other. Each class also gets its own Postmark message
stream (separate suppression list + reputation). See
[docs/email-architecture.md](docs/email-architecture.md) for the full four-class
model — this section is the AR-specific (marketing) slice.

### Subdomains

1. **`mail.heyhenry.io`** — transactional (`outbound-transactional` stream). Keep as-is.
2. **`send.heyhenry.io`** — marketing, for AR sends (`outbound-marketing` stream).
   Add in Postmark dashboard → Sender Signatures / Domains → Add Domain →
   `send.heyhenry.io`.

### DNS records (add to heyhenry.io DNS)

For `send.heyhenry.io`, Postmark issues the exact records to publish — copy them
from the dashboard rather than hand-typing (they're per-domain and rotate):

- **DKIM**: the Postmark-issued DKIM `TXT`/`CNAME` at the selector for `send`.
- **Return-Path (CNAME)**: e.g. `pm-bounces.send.heyhenry.io` → Postmark's bounce
  host, so bounces align for DMARC.
- **TXT (DMARC)** on root `heyhenry.io`:
  `_dmarc.heyhenry.io  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@heyhenry.io; adkim=r; aspf=r"`

Wait for Postmark to show DKIM + Return-Path green (usually <15 min, up to a few hours).

### Postmark webhook

In the Postmark dashboard, on the `outbound-marketing` stream → Webhooks, point
the endpoint at our receiver (the same route handles all three outbound streams):

- URL: `https://app.heyhenry.io/api/ar/webhooks/postmark?token=<POSTMARK_OUTBOUND_WEBHOOK_TOKEN>`
- Events (RecordTypes): Delivery, Bounce, Spam Complaint, Open, Click.
- The `?token=` value must match the `POSTMARK_OUTBOUND_WEBHOOK_TOKEN` env var —
  that's how the route authenticates the callback.

### Cron dispatch

**Vercel Hobby plan blocks sub-daily crons**, so Vercel Cron isn't viable until
the plan is upgraded to Pro. Two working options today:

**Option A (current): external pinger.** Use cron-job.org (free) or similar.

1. Sign up at https://cron-job.org
2. Create new cronjob:
   - URL: `https://app.heyhenry.io/api/ar/cron`
   - Schedule: every minute
   - Request method: GET
   - Headers: add `Authorization` = `Bearer <CRON_SECRET value>`
3. Save + enable.

**Option B (future): Vercel Pro.** When upgraded, re-add `vercel.json` with
`{ "crons": [{ "path": "/api/ar/cron", "schedule": "* * * * *" }] }` and
remove the external pinger. Vercel will inject the auth header automatically.

## Smoke test (local)

1. `supabase db reset` — applies 0040 migration
2. Seed a platform contact + sequence + one email step via SQL (MCP tools land in Phase 2)
3. Enroll the contact: insert row into `ar_enrollments` with `next_run_at = now()`
4. Hit `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/ar/cron`
5. Check `ar_send_log` for the row

## Compliance notes

- **RFC 8058 one-click unsubscribe**: the executor injects both the
  `List-Unsubscribe: <{appUrl}/unsubscribe/{token}>` header and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` on every AR email, and
  the `POST /unsubscribe/:token` route handles the one-click confirmation.
  Tokens are per-contact/global-scope, signed via `AR_UNSUB_SECRET`.
- **CASL / CAN-SPAM**: unsubscribe link is global (writes to suppression list),
  so re-enrollment via any tenant is blocked.
- **SMS quiet hours** are stricter than email: 21:00–10:00 Mon–Fri by default.

## Known Phase 1 gaps (tracked for later)

- Branch steps are no-ops.
- No duplicate-enrollment guard; `allow_reenrollment` is read but not enforced.
- MCP tools / UI / broadcasts / segments — all Phase 2+.
