# HeyHenry Email Architecture

Durable reference for the four-class email system at HeyHenry. Designed to scale to 10k tenants without reputation cross-contamination, and to coexist with Google Workspace on the root domain.

**Sister doc:** [docs/email-templates.md](./email-templates.md) covers the visual + content layer (the `renderEmailShell` standardization, callout/CTA variants, subject-line conventions, CASL category picking, pre-ship verification).

**Last updated:** 2026-05-29
**Status:** Live on Postmark. Stream routing + the per-class From split (transactional / marketing / tenant-originated) are implemented in code (`src/lib/email/send.ts`). What remains operator-side is confirming each sending subdomain is DKIM/Return-Path verified in the Postmark dashboard and that DNS is fully cut over (see "Current state").

## The provider: Postmark with message streams

We send through **Postmark** (`src/lib/email/client.ts`, `src/lib/email/send.ts`). Postmark partitions a server into **message streams**, each with its own reputation, per-stream tracking settings, and independent suppression list. We run three outbound streams:

| Stream ID | Constant | Default sender | Purpose |
|---|---|---|---|
| `outbound-transactional` | `STREAM_TRANSACTIONAL` | `HeyHenry <noreply@mail.heyhenry.io>` | auth, welcome, receipts, invoices, platform notices |
| `outbound-marketing` | `STREAM_MARKETING` | `HeyHenry <newsletters@send.heyhenry.io>` | drip, broadcasts (CASL-bound, via the AR engine) |
| `outbound-tenants` | `STREAM_TENANTS` | `noreply@tenants.heyhenry.io` (display name = tenant) | emails our tenants send to THEIR customers |

`send.ts` auto-routes every call to one of these streams: a tenant From header → `outbound-tenants`; a CEM CASL category (`implied_consent_*`, `express_consent`) → `outbound-marketing`; everything else → `outbound-transactional`. Tracking follows the stream — opens + link tracking ON for marketing/tenants, OFF for transactional (auth-adjacent mail gets pre-clicked by Gmail's link scanner, which inflates click counts and burns one-time tokens).

## The four classes of email

| Class | Sender domain | Volume estimate (10k tenants) | Reputation poisoning risk |
|---|---|---|---|
| **Corporate (receive)** | `heyhenry.io` (root) — Google Workspace | n/a (inbound only) | Low — but if root domain reputation tanks because we sent from root, our own mail starts going to spam |
| **Transactional** | `mail.heyhenry.io` — Postmark (`outbound-transactional`) | ~10k–50k/month (welcomes, receipts, password resets) | Medium — auth-flow failures hurt revenue directly |
| **Marketing** | `send.heyhenry.io` — Postmark (`outbound-marketing`) | ~50k–500k/month (drip, broadcasts) | High — one campaign can get flagged |
| **Tenant-originated** | `tenants.heyhenry.io` — Postmark (`outbound-tenants`) | **2M+/month** at 10k tenants | Highest — one tenant's spammy behaviour shouldn't tank everyone |

**The fundamental rule:** never let one class poison another. Isolation comes from two layers that reinforce each other:
- **Sending subdomain** — each class sends from its own subdomain, so reputation is isolated in inbox-provider eyes (Gmail, Outlook, Apple Mail).
- **Postmark stream** — each class is a separate stream, so suppression lists, bounce handling, and tracking are isolated inside Postmark too.

## Target architecture

```
heyhenry.io                    Google Workspace (RECEIVE only)
  ├─ jonathan@heyhenry.io      → real human
  ├─ hello@heyhenry.io         → shared inbox (already advertised on marketing site)
  └─ support@heyhenry.io       → shared inbox

mail.heyhenry.io               Postmark — stream: outbound-transactional
  └─ noreply@mail.heyhenry.io  → auth, welcome, receipts, invoices
                                  reply-to set per-tenant or to hello@

send.heyhenry.io               Postmark — stream: outbound-marketing
  └─ newsletters@send.heyhenry.io → drip, broadcast (CASL-bound)
                                    handled by AR engine in src/lib/ar/

tenants.heyhenry.io            Postmark — stream: outbound-tenants
  └─ noreply@tenants.heyhenry.io → emails our tenants send to THEIR customers
                                    From: "Acme Renos" <noreply@tenants.heyhenry.io>
                                    Reply-To: tenant's contact email
```

## Why each piece matters

**Don't send from root.** Once Google Workspace is on `heyhenry.io`, we can technically send from any address there too (SPF can include both Google and Postmark). But a marketing complaint or a spammy tenant on the root domain risks blacklisting `jonathan@heyhenry.io`. Always send from a subdomain.

**Marketing on its own subdomain + stream.** `send.heyhenry.io` / `outbound-marketing`, driven by the AR engine. Spam complaints there land on the marketing stream's suppression list and reputation, not transactional. CASL unsubscribe headers etc. are handled there.

**Tenant-originated on its OWN subdomain + stream.** This is the volume one — at 10k tenants and 200 emails/tenant/month that's 2M+ emails/month. If one tenant blasts 1000 customers with a deal that gets reported, that hit lands on `tenants.heyhenry.io` / `outbound-tenants`, not `mail.heyhenry.io` where password-reset emails live. The split is wired: any `sendEmail` call with a `tenantId` (and no explicit `from`) builds the tenant From header via `getTenantFromHeader()` and routes to `outbound-tenants`.

## Current state (2026-05-29)

**Code routes all three classes correctly:**
- `src/lib/email/client.ts` exports `FROM_EMAIL` / `FROM_EMAIL_TRANSACTIONAL`, `FROM_EMAIL_MARKETING`, `FROM_EMAIL_TENANTS_ADDR`, and the three `STREAM_*` IDs.
- Reads `POSTMARK_FROM_EMAIL_TRANSACTIONAL`, `POSTMARK_FROM_EMAIL_MARKETING`, `POSTMARK_FROM_EMAIL_TENANTS` env vars; falls back to the verified-sender defaults baked into `client.ts` when unset.
- `src/lib/email/send.ts` picks the stream + From + tracking flags per send (see "The provider" above).
- Engagement + deliverability events flow back via the Postmark webhook at `src/app/api/ar/webhooks/postmark/route.ts` (Delivery / Bounce / SpamComplaint / Open / Click → updates `ar_send_log`, writes the suppression list, and flips the CASL `do_not_auto_message` kill switch on a complaint).

**Operator-side, confirm before assuming clean deliverability:**
- `POSTMARK_SERVER_TOKEN` set in the Vercel environment.
- `mail.heyhenry.io`, `send.heyhenry.io`, `tenants.heyhenry.io` each verified in the Postmark dashboard (DKIM + custom Return-Path), with the matching DNS records live.
- DMARC on the root domain.
- Google Workspace on the root (corporate receive) — separate, MX-only.

## DNS + Postmark verification

Each sending subdomain needs to be added in the **Postmark dashboard → Sender Signatures / Domains**, which generates the exact records to publish at the heyhenry.io DNS host. Postmark verification uses, per domain:
- **DKIM** — a `TXT`/`CNAME` record at the Postmark-issued DKIM selector for the subdomain.
- **Return-Path (bounce alignment)** — a `CNAME` (e.g. `pm-bounces.<subdomain>` → Postmark's bounce host) so bounces align for DMARC.
- **SPF** — include Postmark's sending host in the subdomain's SPF (`include:spf.mtasv.net`), if you publish SPF on the bounce/return-path domain.

Always copy the exact record values from the Postmark dashboard rather than hand-typing them — they're per-domain and rotate.

Root-domain DMARC covers all subdomains:
- `TXT _dmarc "v=DMARC1; p=none; rua=mailto:dmarc@heyhenry.io; pct=100"`
- Set `p=none` initially for monitoring; tighten to `p=quarantine` after 30 days of clean reports.

Verification after publishing:
- Confirm green checkmarks (DKIM + Return-Path) on each domain in the Postmark dashboard.
- Send a test on each stream, inspect headers in Gmail (View original → SPF: PASS, DKIM: PASS, DMARC: PASS).

## Phase 3 — Dedicated IPs + sharding (when needed, NOT built)

**Owner: dev + ops**

Trigger: when shared-IP volumes start showing reputation flags, or any single domain crosses ~100k/day.

- Move `tenants.heyhenry.io` to a dedicated IP pool in Postmark.
- Move `mail.heyhenry.io` to a dedicated IP pool (separate from tenants).
- If a major tenant starts dominating volume, shard the tenant subdomain to `t1.heyhenry.io`, `t2.heyhenry.io`, etc.

This is a "we'll know when we get there" phase. Postmark offers dedicated IPs at higher tiers. Don't over-engineer until reputation actually shows signs of stress.

## Google Workspace coexistence

Google Workspace receives mail on the root domain via MX records. It does NOT conflict with our Postmark sending because:
- Sending uses subdomains (`mail.*`, `send.*`, `tenants.*`) — no MX records needed there.
- SPF/DKIM/DMARC for the root domain are Google-only.
- SPF/DKIM/Return-Path for the subdomains are Postmark-only.

Setup steps for Google Workspace (kanban [9360c1c8 ops board](https://ops.heyhenry.io/admin/kanban/ops) — extend or spawn new):
- Sign up for Google Workspace at the heyhenry.io domain
- Add MX records pointing to Google
- Set up SPF + DKIM + DMARC for Google
- Create `jonathan@`, `hello@`, `support@` mailboxes (or routing groups)
- Test inbound delivery: send an email to `hello@heyhenry.io` from an external account, confirm it lands in the Workspace inbox

## What NOT to do

- **Never put Google Workspace on a sending subdomain** — keeps reputation isolated
- **Never send from root domain** in production code — even if Google Workspace SPF includes Postmark (it doesn't by default), we want isolation
- **Never reuse `noreply@` across subdomains** for different classes — each class needs its own from-address so unsubscribe and reply behaviour is class-appropriate

## Open questions for future work

- **Bounce handling**: the Postmark webhook already records bounces on `ar_send_log` and writes the AR suppression list. We do NOT yet act on bounces for non-AR transactional mail (no `email_bounced_at` flag on tenants). Add when bounce volume becomes a real signal.
- **Reply routing for `noreply@mail.*`**: today these emails have reply-to set per-tenant. For our own auth/welcome emails (no tenant context), reply-to is `hello@heyhenry.io`. Want to formalize this in the welcome email helper.
- **Inbound parsing**: inbound email is handled via Postmark inbound on `inbound.heyhenry.io` (see [INBOUND_EMAIL_PLAN.md](../INBOUND_EMAIL_PLAN.md)). If we ever need to receive at another subdomain, point its MX at the Postmark inbound webhook.
