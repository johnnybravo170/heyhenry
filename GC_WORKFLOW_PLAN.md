# GC Quote-to-Invoice Workflow — Build Plan

**Date:** 2026-04-19
**Vertical:** Renovation / General Contracting (JVD)
**Status:** Schema complete. UI gaps listed below.

---

## What's already built

**Schema (all migrations applied):**
- `projects` — status (planning/in_progress/complete/cancelled), percent_complete, management_fee_rate (12% default), portal_slug, portal_enabled
- `project_cost_buckets` — per-project buckets (interior/exterior/general), estimate_cents
- `cost_bucket_templates` — per-tenant reusable bucket sets
- `project_memos` — voice memo → transcript → AI extraction pipeline
- `time_entries` — hours against project + bucket (workers + owner)
- `expenses` — receipts against project + bucket, receipt_url
- `change_orders` — full approval flow (draft → pending_approval → approved/declined/voided), cost + timeline impact, approval_code
- `project_portal_updates` — progress/photo/milestone/message/system updates
- `quotes.approval_code` — public quote acceptance without login
- `invoices.line_items` JSONB + `customer_note` + `payment_method`

**UI already live:**
- `/projects` list (functional)
- `/projects/new` (exists — need to verify completeness)
- `/projects/[id]` (exists — need to verify completeness)
- `/portal/[slug]` — homeowner portal (functional: loads project, status, updates)
- `/approve/[code]` — change order approval page (fully functional: approve/decline with name entry)

---

## The GC workflow (vs pressure washing)

Pressure washing: **quote → job → single invoice**

GC/renovation: **estimate → project → [change orders] → [progress invoices] → final invoice**

Key differences:
- Estimates are **line-item / cost-bucket based**, not polygon area
- A quote converts to a **project**, not a job
- Projects run **weeks to months** with sub-milestones
- Invoicing is **milestone-based** (deposit, draws, holdback release, final) — not one invoice at job completion
- **Change orders** mutate the approved budget; they must be signed off before work proceeds
- **Management fee** (12% default) calculated on cost actuals, not just materials

---

## Workflow stages + UI gaps

### Stage 1 — Estimate (Quote)

**What:** Line-item quote against cost buckets. Customer approves without logging in.

**Already built:** `quotes` table, quote PDF, Resend email, `approval_code` + `/approve/[code]` page (for change orders — verify quote approval reuses same pattern or has its own route).

**Gaps to verify:**
- [ ] Does the quote form support line-item entry (not just polygon area) for renovation? If not, add a "renovation mode" line-item form path based on `tenant.vertical`.
- [ ] Public quote acceptance page at `/q/[approval_code]` — distinct from change order approval.

---

### Stage 2 — Project Creation (Quote → Project)

**What:** Accepted quote converts to a project. Cost buckets are seeded from the quote line items. Portal slug generated. Customer receives portal link.

**Gaps:**
- [ ] "Convert to project" action on accepted quote detail page.
- [ ] On conversion: create `project`, seed `project_cost_buckets` from quote line items, set `portal_slug` (nanoid), optionally enable portal + email homeowner the link.
- [ ] `cost_bucket_templates` management UI in Settings (so JVD doesn't rebuild buckets for every similar reno job).

---

### Stage 3 — Active Project (Time, Expenses, Progress)

**What:** Day-to-day tracking. Time entries and expenses log against buckets. Homeowner sees updates on the portal.

**Gaps:**
- [ ] Time entry form on project detail (owner + worker — workers see stripped-down view).
- [ ] Expense logging form with receipt photo upload → receipt_url stored.
- [ ] Budget tracker on project detail: estimate vs actual per bucket, running management fee.
- [ ] Portal update composer: post progress update / milestone / photo to `/portal/[slug]`.
- [ ] Percent-complete slider on project detail (visible on portal).

---

### Stage 4 — Change Orders

**What:** Scope change → draft CO → send for approval → homeowner approves at `/approve/[code]` → budget + timeline updated automatically.

**Already built:** Full approval page at `/approve/[code]` (approve/decline with name capture). Schema has full status machine.

**Gaps:**
- [ ] Change order creation form on project detail page (title, description, reason, cost impact, timeline impact, affected buckets).
- [ ] "Send for approval" action: sets status to `pending_approval`, generates `approval_code` (nanoid), emails homeowner the `/approve/[code]` link.
- [ ] On approval webhook/server action: update `project_cost_buckets` estimate_cents + project target_end_date.
- [ ] Change order list on project detail with status badges.

---

### Stage 5 — Progress Invoicing (Milestone Draws)

**What:** Invoice a portion of the project at a milestone (deposit, rough-in complete, etc.) before the job is done. Uses `invoices.line_items` JSONB.

**Gaps:**
- [ ] "Create milestone invoice" action on project detail.
- [ ] Invoice form for GC: free-form line items (label + amount) + optional `customer_note` + management fee line.
- [ ] Track which milestones have been invoiced; show running total billed vs contract value on project detail.
- [ ] `payment_method` selector on invoice (stripe/cash/cheque/e-transfer/other) — already in schema.

---

### Stage 6 — Final Invoice

**What:** Project complete → final invoice calculates actuals (time + expenses + management fee) vs amount already invoiced → produces balance-owing invoice.

**Gaps:**
- [ ] "Generate final invoice" action: reads all time_entries + expenses for the project, applies management_fee_rate, subtracts prior invoiced amounts, produces a pre-filled invoice draft.
- [ ] Final invoice PDF (same template as existing, but with project name header and cost breakdown).

---

## Build order

These are independent enough to parallelize in tracks after Stage 2 is done.

| Order | Track | Unlocks |
|---|---|---|
| 1 | Quote line-item mode + quote acceptance page | Stage 1 |
| 2 | Quote → Project conversion | Stage 2 |
| 3A | Time + expense logging | Stage 3 actuals |
| 3B | Change order creation + send | Stage 4 |
| 3C | Portal update composer + percent-complete | Stage 3 visibility |
| 4 | Budget tracker (estimate vs actual per bucket) | Milestone invoicing |
| 5 | Milestone invoice creation | Stage 5 |
| 6 | Final invoice generation | Stage 6 |

---

## Key decisions to confirm before building

1. **Quote line items for renovation** — does the existing quote form need a vertical-aware mode, or do we build a separate "project estimate" flow that lives under `/projects/new` rather than `/quotes/new`?
2. **Milestone invoice naming** — "Draw #1", "Deposit", etc. — free-form label or predefined types?
3. **Management fee display** — show as a separate line on invoice to customer (transparent) or baked into totals (simpler)?
4. **Holdback** — BC construction lien holdback (10%) on each draw? JVD to confirm if he needs this.
5. **Portal email cadence** — auto-notify homeowner on every portal update, or only when contractor explicitly triggers it?

---

## Backlog / future features

### Customer closeout package (ZIP)

At job completion, generate a downloadable ZIP the contractor can hand to the homeowner containing:

- Jobsite photos (tenant-selectable — before/after/progress subset, not the full dump).
- Material + colour reference sheet: paint codes, tile SKUs, grout colour, flooring model #s, hardware finishes, appliance model/serial, etc. Sourced from cost-line metadata and/or a new "spec sheet" field on cost lines or buckets.
- Optional: warranty docs, care instructions, final invoice PDF, change order summary.

Triggered from the project page once status is `completed`. ZIP is built server-side and either downloaded directly or emailed via the portal.

Open questions:
- Where do colour/material codes live today? Currently freeform in cost-line descriptions — likely need structured fields (`spec_code`, `spec_label`, `supplier`) on cost lines or a separate `project_specs` table.
- Tenant photo selection UI — reuse the existing gallery with a multi-select + "Include in closeout" toggle?
- Delivery: direct download vs homeowner portal vs emailed link?

---

## Source research (vault)

- `Renovation Vertical — Competitive Analysis + Remodeler Pain Points (April 2026)` — 6 pain clusters, competitor gaps, what to build
- `Contractor OS Architecture Plan` — modules list for renovation vertical
- `SPEC-v1.md` — JVD's specific requests (walk-and-record voice memo → quote draft, biweekly budget reports)
- `HeyHenry UX Principles` — edit where you look, no login walls for customers, preview before send
