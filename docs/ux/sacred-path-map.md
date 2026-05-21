# HeyHenry — The Sacred Path: End-to-End Workflow Map

> **Grounded in (real code):** `src/server/actions/{quotes,change-orders,invoices,project-cost-control,cost-lines,project-budget-categories,qbo}.ts`, the Stripe webhook `src/app/(public)/api/stripe/webhook/route.ts`, the QBO import library `src/lib/qbo/import/*` + `oauth.ts`/`client.ts`, the project detail route `src/app/(dashboard)/projects/[id]/page.tsx` (+ Budget/Spend/Customer-Billing tab servers), the public surfaces `(public)/view/[id]`, `(public)/approve/[code]`, `(public)/view/invoice/[id]`, and migration `0032_renovation_phase_r2.sql` / `20260513165500_atomic_mutation_rpcs.sql`.
> **Grounded in (vault):** Workflow Library `e0263cc3` · Object Model `b4d880be` · Role × Object Matrix `03b1ccf4` · IA & Nav Map `6529e9ae` · GC V1 Sacred Launch Path & Scope Lock `4d0fd021` · Project Hub Spec `6c0de27d`.
> **Method:** `heyhenry-workflow-mapping` skill. Reconciled **2026-05-21**.
> **Discipline:** CURRENT-STATE TRUTH with **target deltas labeled**. Where the vault's "locked decisions" diverge from the built code, the divergence is called out — that *is* the point of grounding. The recurring project mistake is designing from an idealized flow; this map refuses to.

---

## The spine (one line)

```
Lead ──> Quote ──[MANUAL convert]──> Project ──> Invoice ──> Payment ──> ⚠QBO(gap)
(customers   draft→sent→accepted    planning→awaiting_approval     draft→sent→paid    Stripe webhook /     IMPORT-ONLY:
 kind=lead)        ↘rejected ↘expired   →active→complete|cancelled        ↘void       manual markPaid       no write-back
                                          ├─ Change Order: draft→pending_approval→approved[applies diff to budget]|declined|voided
                                          └─ Costs: project_costs receipt|vendor_bill, unpaid→paid (feed budget actuals)
```

Read it as: **a Quote becomes the contract; an explicit human step turns it into a Project; the Project accrues change orders + costs against a budget; the Project emits draw/final invoices; Stripe or a manual mark collects payment; and then the chain stops — nothing reaches QuickBooks.** Each hop below is mapped in the skill's shape.

---

## Reconciliation findings — where the idealized flow ≠ the real code

These six are the headline. They change what "trustworthy end to end" (the Scope-Lock launch gate) actually means.

> **⚠ CORRECTION (2026-05-21, post quote-UI grounding + decisions).** Grounding the quote UI revealed the path's front half is split by vertical, and three decisions are now made:
> - **The GC estimate is NOT the `quotes` table.** `/quotes` hard-redirects renovation/tile tenants to `/projects` (`quotes/page.tsx:32`) — the legacy PW `quote-form` is **out of GC V1 scope**. For GC, the "estimate" = `project_cost_lines` gated by `projects.estimate_status` (`draft→pending_approval→approved|declined`), authored on the **project Budget tab**, sent from `/projects/[id]/estimate/preview`, approved on public **`/estimate/[code]`** (actions `sendEstimateForApprovalAction`, `approveEstimateAction`, `manuallyApproveEstimateAction`). **So S1 (Quote) and S3 (conversion) below describe the deprioritized PW path; the GC path is the project estimate** — and **S1+S3+S4 collapse into one state-adaptive Budget surface** (authoring vs execution posture). See `docs/ux/briefs/estimate.md`.
> - **DECIDED — Quote→Project (finding #1):** for GC this is a **non-issue** — the project exists from lead-accept, the estimate lives inside it, and approval flips `estimate_status→approved` + `lifecycle→active` + snapshots the contract baseline. "Auto-create on approval" only ever applied to the PW `quotes` path. No GC orphan.
> - **DECIDED — QBO (finding #2):** **import-only is sufficient for V1.** Reconciliation is the (out-of-scope) bookkeeper portal's job; outbound invoice/payment sync is parked for V2.
> - **DECIDED — drill-down order:** GC **Estimate** first (done → `briefs/estimate.md`), then the **Project Hub** (execution posture of the same Budget table).

1. **Quote → Project is NOT auto-created — contradicts a "locked decision."** README "locked decisions" and the workflow skill both state *"approved quote auto-creates the Project."* The code does not: `acceptQuoteAction` (`quotes.ts:497`) only sets `status='accepted'` + seeds AI tasks; the Project is created by a **separate manual `convertQuoteToProjectAction`** (`quotes.ts:658`, guards `status==='accepted'`). Object Model + Workflow Library both label auto-create a **target delta, not built**. → This is the single biggest *internal* seam: an accepted quote with no project is a real, reachable orphan state.

2. **QBO is IMPORT-ONLY — the terminal hop does not exist as imagined.** `actions/qbo.ts` is only OAuth connect/disconnect. Everything in `src/lib/qbo/import/*` is **inbound** (estimates, invoices, bills, customers, vendors, items, payments, purchases read *from* QBO into HeyHenry, paginated, cron-resumable). **No code creates an invoice, customer, or payment in QuickBooks.** The accepted-quote → invoice → payment lifecycle never reaches QBO. Yet "QBO sync" is V1-in-scope and a launch gate. → The "→ QBO" arrow in the sacred path is currently a one-time historical migration, **not** a live two-way sync. Decision required (see Open Questions).

3. **"Editing / Executing modes" don't exist** — removed (decision `6790ef2b`), replaced by a **unified Budget view**. `budget-tab-server.tsx:27` literally comments *"One view — no Editing/Executing toggle."* The only vestige: `lifecycle_stage` drives default **expand/collapse** + default tab (`projects/[id]/page.tsx:152-160`); `?mode=editing|executing` survive only as aliases for `?expand=all|none`. The meaningful distinction the Project Hub spec actually draws is **"Mobile = doing work, Desktop = thinking work"** and **portfolio vs single-project**, not a mode flip.

4. **Two parallel verticals: `jobs` (legacy/PW) vs `projects` (GC), both still wired.** `convertQuoteToJobAction` + `createInvoiceAction(jobId)` = legacy pressure-washing; `convertQuoteToProjectAction` + the three project invoice actions = GC. Both appear in the quote UI (`quote-actions.tsx:226` & `:250`). Invoices carry `job_id NOT NULL`, `project_id` nullable — **the invoice→project link runs *through* the job.** Structural debt sitting directly on the path.

5. **"Estimate" overloads two different things.** In the quote UI/emails, "estimate" = the `quotes` table (no separate object). But `createInvoiceFromEstimateAction` (`invoices.ts:1247`) takes a **`projectId`** and itemizes the project's **`project_cost_lines`** — "estimate" there means the *project budget lines*, not the quote. Same word, two referents.

6. **Doc/code drift to keep honest:** `lifecycle_stage` — Object Model doc says `in_progress`; code uses `awaiting_approval` / `active`. Scope-Lock lists **"Helcim EFT"** as a V1 payment rail; the code has only Stripe + **manual** Interac e-Transfer recording (no Helcim integration found). Holdback: older Project-Hub/compliance docs surface it; the May-20 Object Model marks it **dropped** (newer wins; the Billing brief already treats it out-of-scope).

---

## Segment maps (skill shape)

### S1 · Lead → Quote (the estimate engine)
**Trigger:** a qualified lead (`customers.kind='lead'`, often from the Inbox intake→Apply pipeline) needs a price.
**Primary actor:** owner / admin / member (the operator). **Surface:** desktop-primary (`/quotes`, quote editor); intake capture is mobile.
**Objects:** `quotes` (+ `quote_line_items`, `quote_surfaces`) ← `customers`.
**State machine:** `draft → sent → accepted | rejected | expired`.
**Happy path:** `createQuoteAction` (`quotes.ts:70`, status `draft`, prices server-side) → operator refines lines → `sendQuoteAction` (`quotes.ts:262`, `draft→sent`, generates PDF, mints `approval_code`, emails a `/view/{id}` link).
**Decision points:** fixed-price vs cost-plus framing; which scope buckets to include (intake may have flagged opt-outs as upsell-hidden CO candidates).
**Failure modes:** AI misses a scope bucket → under-quote (scope-gap detection mitigates, not eliminates); surface/sqft pricing wrong (PW-shaped pricing carryover); email bounces → customer never sees it; quote sits unanswered → **stale** (the classic time-sink).
**Approval points:** none internal; external approval is S2.
**Role handoffs:** operator → (send) → homeowner.
**Henry leverage (built):** voice/screenshot → quote draft; scope-gap detection; plain-English line descriptions; **Stale Quote Chaser** (`/quotes/stale`). The JVD/Lori case (30–60 min manual thread-parsing → 5 min review) is the canonical win here.
**Mobile/desktop:** capture mobile (drop the mess), build/refine desktop.
**Success signal:** quote `sent` → `accepted`.
**Brief status:** **NOT briefed.** (Contacts brief covers the *lead*; the quote builder/editor + `/quotes` list are open.)
**Open questions:** does "expired" auto-transition or is it manual? Cost-plus vs fixed-price toggle placement.

### S2 · Quote Approval (the first external hand-off)
**Trigger:** customer opens the link. **Actor:** homeowner (no login). **Surface:** public `/view/[id]`.
**Objects:** `quotes`.
**State machine:** `sent → accepted` (`approveQuotePublicAction`, `quotes.ts:820`) | `sent → rejected` (`declineQuotePublicAction`, `quotes.ts:954`).
**Happy path:** homeowner reads the estimate ("Your Estimate"), types their name, approves. e-signature = typed name (Scope-Lock counts this as the DocuSign replacement).
**Failure modes / seams:** page is keyed by **raw quote id**, not `approval_code` (mild enumeration surface; the minted code is actually the *CO* mechanism); a **re-send** can change the document under a customer mid-decision; no hard expiry enforcement observed.
**Approval points:** EXTERNAL, customer. Emits the accept; **does not create the project** (see S3).
**Role handoffs:** homeowner → (approval event) → operator.
**Henry leverage:** plain-English estimate; (target) read-receipt / nudge timing.
**Success signal:** `accepted`.
**Brief status:** NOT briefed.

### S3 · Quote → Project conversion (the manual seam)  ⚠
**Trigger:** operator decides to book an accepted quote. **Actor:** operator. **Surface:** quote detail action.
**Objects:** `quotes` → `projects` (+ 9 default `project_budget_categories`, `management_fee_rate=0.12`).
**State machine (project):** `planning → awaiting_approval → active → complete | cancelled` (code-observed; Object Model doc lags as `in_progress`).
**Happy path:** `convertQuoteToProjectAction` (`quotes.ts:658`) — guarded on `accepted` — creates the Project in `planning`, seeds budget. *(Legacy: `convertQuoteToJobAction` → `jobs`.)*
**Failure modes:** operator forgets to convert → **accepted-quote-with-no-project orphan**; double-convert; picks `jobs` vs `projects` (dual-path confusion).
**Approval points:** none.
**Henry leverage (target):** auto-create on approval (closes finding #1) OR a one-tap "Book this" prompt on accepted quotes; flag accepted-but-unconverted quotes.
**Success signal:** Project exists in `planning` with seeded budget.
**Brief status:** NOT briefed — but this is a *seam*, likely handled inside the Quote-detail and/or Projects-list briefs rather than its own screen.

### S4 · Project Execution (the Hub)  — HEAVIEST
**Trigger:** Project exists. **Actor:** operator (desktop "thinking"), worker (mobile "doing", assigned-only). **Surface:** `/projects/[id]`, both devices.
**Objects:** `projects`, `project_budget_categories`, `project_cost_lines`, `project_costs`, `time_entries`, `photos`, `worklog_entries`, `change_orders`, `invoices`.
**State machine:** lifecycle as S3; the hub is a *container*, not a single FSM — its sub-objects each carry their own (CO=S5, costs=S6, invoice=S7).
**Real tabs (`page.tsx:166-186`):** primary **Budget** (consolidates old Estimate + Change-Orders), **Spend** (`costs`), **Time**, **Schedule**, **Customer Billing** (`invoices`), **Overview**; secondary icon pills: Messages, Gallery, Portal, Selections, Documents, Notes (`memos`), Crew. Default tab: `planning`/`awaiting_approval` → Budget; else → Overview. Overview = the "cockpit," under active development.
**Budget truth:** when a category has priced lines, **Σ `line_price_cents` IS the estimate** (`syncCategoryEstimate` invariant, `project-cost-control.ts:52`); envelope `estimate_cents` is a fallback. Budget-vs-actual = labour(`time_entries`) + expenses + bills(`project_costs`, pre-tax since GST is an ITC); `committed_cents` = accepted sub-quotes + active PO lines; `remaining = estimate − spent − committed`. Margin: revenue = `scope_subtotal + mgmt_fee`; `margin_at_risk = estimated − actual − committed` (danger when < 0).
**The contract baseline:** "**the accepted quote IS the contract baseline**" — the hub *references* it and shows a **diff** when COs change scope; it does **not** duplicate line items (`UnsentChangesChip` / `ScopeDiffReview` are live on the Budget tab).
**Failure modes:** margin-at-risk goes negative unnoticed; offline field capture not synced; committed-vs-spent confusion; the dead "Henry suggests" strip means over/under-budget nudges are **not** currently surfaced (see below).
**Henry leverage (built):** variance/margin numbers (Overview `VarianceTab`), unsent-changes scope diff, estimate-feedback card. **(aspirational/DEAD):** `getProjectInsights` + `henry-insight-strip.tsx` (the "Henry suggests over/under budget" strip) exist but are **wired nowhere** — header still says "(Executing mode)," predating the redesign. **(elsewhere):** Pulse drafting (`server/ai/pulse.ts`) exists but its composer lives on the *jobs* surface, not the hub.
**Mobile/desktop split:** desktop = budget reconciliation, job costing, multi-line CO authoring, closeout; mobile = photo+voice capture, schedule glance, quick CO voice draft, approvals.
**Success signal:** job runs at/above target margin; truth captured from the field; reaches `complete`.
**Brief status:** **NOT briefed — the heaviest open screen.** (Projects *list* is briefed; the *detail/hub* is not.)

### S5 · Change Order
**Trigger:** scope change on an active Project. **Actor:** operator (draft) → homeowner (approve). **Surface:** `/projects/[id]/change-orders[/new|/[coId]]` + public `/approve/[code]`.
**Objects:** `change_orders` (+ `change_order_lines`).
**State machine:** `draft → pending_approval → approved | declined | voided` (`0032_renovation_phase_r2.sql:21`).
**Happy path:** `createChangeOrderV2Action` (`change-orders.ts:308`, `flow_version:2`, line-diff add|modify|remove|modify_envelope, mints `approval_code`) → `sendChangeOrderAction` (`:776`, `draft→pending_approval`, email + SMS the `/approve/{code}` link) → `approveChangeOrderAction(code,name)` (`:930`, `→approved`, then **`applyV2ChangeOrderDiff`** `:55` writes the diff to `project_cost_lines`/`project_budget_categories`, idempotent on `applied_at`).
**Decision points:** v2 line-diff vs legacy v1 even-distribute (`flow_version`).
**Failure modes:** diff targets a missing line → `orphaned_line`/`envelope_missing` (non-fatal warnings, stamped in `apply_warnings`); **CO approved but never billed** — by design (no auto-bill) but easy to *forget* → silent revenue leak; customer declines.
**Approval points:** EXTERNAL. **Locked:** approval updates **budget**, never auto-bills.
**Henry leverage:** voice note + photos → CO draft; cost/time impact estimate; plain-English homeowner explanation.
**Success signal:** `approved` + diff applied + later included in an invoice.
**Brief status:** NOT briefed (folded into Budget tab today; needs its own authoring + approval treatment).

### S6 · Job Costing
**Trigger:** money out — receipt, vendor bill, sub-quote, labour. **Actor:** operator (worker if `can_log_expenses`). **Surface:** `/expenses` + project **Spend** tab; capture mobile.
**Objects:** `project_costs` (unified: `source_type` receipt|vendor_bill; `payment_status` unpaid|partial|paid; `status` active|void).
**Happy path:** `upsertCostLineAction` (receipt) / `upsertBillWithAttachmentAction` (`project-cost-control.ts:246`, vendor bill, gross + pre-tax + GST) → `markBillPaidAction` (`:428`). Bank import matched via `bank_tx_match_candidates`.
**Failure modes:** receipt uncategorized → budget actuals understated; unpaid-bill pile; bank tx unmatched; GST/ITC mis-split.
**Henry leverage:** receipt OCR → cost draft (via intake); categorize from vendor; flag missing receipts; the margin/variance signal that flows up to S4.
**Mobile/desktop split:** capture mobile (capture-now/clean-up-later, offline-tolerant), reconcile desktop.
**Success signal:** every dollar out lands on a line; budget actuals are true.
**Brief status:** NOT briefed (Expenses screen + Spend tab).

### S7 · Invoicing → Payment
**Trigger:** billable work (milestone, completion, approved CO). **Actor:** operator → homeowner (pay). **Surface:** `/invoices` (→ rename "Billing") + project **Customer Billing** tab; public `/view/invoice/[id]`.
**Objects:** `invoices` (+ `invoice_payment_receipts`).
**State machine:** `draft → sent → paid | void` (`validators/invoice.ts:11`, enforced by `canTransition`). **No partial payments** (stages = separate **draw** invoices); **no holdback**; **no due_date** (overdue derived: `sent` && `sent_at` > 14d).
**Invoice variants:** `createInvoiceAction(jobId)` (legacy, needs `job.status='complete'`, amount from quote total) · `createInvoiceFromEstimateAction(projectId)` (itemizes `project_cost_lines` + mgmt fee) · `createMilestoneInvoiceAction(projectId)` (`doc_type='draw'`, percent_complete, GST mode) · `generateFinalInvoiceAction(projectId)` (branches `is_cost_plus`; subtracts prior invoices; cost-basis drift guardrail).
**Payment:** Stripe webhook `checkout.session.completed` → **`mark_invoice_paid` RPC** (atomic, sets `paid_at` + `stripe_payment_intent_id`) **OR** manual `markInvoicePaidAction` (cash/cheque/e-transfer). Interac e-Transfer is first-class at parity with Stripe.
**Failure modes:** **orphan drafts** (5 identical Mohan drafts — draw schedule illegible); **first send blocked** if tenant has no GST number (`invoices.ts:237`); **Stripe not connected → no pay link** (link is overloaded into `pdf_url`, null without Stripe); overdue chase.
**Approval points:** EXTERNAL (pay).
**Henry leverage (built/target):** AR follow-up engine (`lib/ar/*` + `henry-nightly` cron, CASL-aware) is live; **ready-to-bill** prompt is target (job-level prompt exists, roll-up pending).
**Success signal:** `paid`, `paid_at` set.
**Brief status:** **BRIEFED** (`docs/ux/briefs/invoices.md` — the Billing/AR cockpit).

### S8 · QBO (terminal)  ⚠ GAP
**Trigger (as built):** onboarding / on-demand import. **Actor:** operator connects; bookkeeper reconciles (separate `/bk` portal, out of scope).
**Reality:** **inbound only.** `src/lib/qbo/import/*` pulls historical estimates/invoices/bills/customers/vendors/items/payments/purchases *into* HeyHenry (cron-resumable). **No outbound write of HeyHenry invoices/payments to QuickBooks.**
**Failure mode (structural):** QBO books never reflect HeyHenry-collected revenue → double-entry / month-end reconciliation burden falls on the bookkeeper. The path's promised "→ QBO" close-out is not closed.
**Decision required:** is the launch gate "QBO sync confirmed" satisfied by **import-only**, or does the sacred path require **outbound invoice/payment sync** that is currently unbuilt? (See Open Questions.)

---

## Cross-cutting — where Henry plugs in (built vs aspirational)

| Step | Built & live | Aspirational / dead |
|---|---|---|
| Intake | classify+extract+route (drop zone), receipt OCR | audio memos (V3) |
| Quote | voice/screenshot→draft, scope-gap, plain-English, **Stale Quote Chaser** | read-receipt nudge |
| CO | voice+photo→CO draft, impact estimate, homeowner explanation | — |
| Costing | receipt→cost, vendor categorize, missing-receipt flag | — |
| Execution | variance/margin numbers, unsent-changes diff, estimate-feedback | **`getProjectInsights`/`henry-insight-strip` (DEAD — "Henry suggests" strip never wired in)** |
| Billing | AR follow-up engine (CASL-aware, nightly cron) | **ready-to-bill roll-up** (job-level exists) |
| Portal | Pulse drafting service exists | Pulse composer is on *jobs* surface, not the hub |

**Discipline (locked):** Henry **drafts, human sends** — no background auto-send of any external artifact. Henry is intelligence behind features, not a chat box.

## Cross-cutting — the time-sinks (what we're actually killing)

1. **Parsing a messy text/email thread into an estimate** — JVD/Lori: 30–60 min → 5 min. (S1)
2. **Chasing quotes that went quiet** — Stale Quote Chaser. (S1/S2)
3. **Re-keying a scope change + explaining it to the homeowner** — CO voice draft. (S5)
4. **Categorizing receipts/bills into job costs** — receipt OCR. (S6)
5. **Figuring out "what can I bill now"** — ready-to-bill roll-up. (S7)
6. **Chasing overdue invoices** — AR follow-up engine. (S7)
7. **Writing homeowner progress updates** — Pulse. (S4/portal)
8. **The manual quote→project step** — a friction the "locked decision" wants gone. (S3)
9. **Month-end reconciliation to QBO** — currently unsolved by the path (S8); falls to the bookkeeper.

## The seams (hand-offs & where trust breaks)

- **Accepted-quote → no project (S3):** the only fully-manual internal hop; the orphan state is reachable.
- **operator ⇄ homeowner (S2, S5, S7):** three public no-login surfaces; the trust moments. Two are id-keyed, one code-keyed — inconsistent.
- **CO approved → budget updated but unbilled (S5→S7):** intentional, but a revenue leak if forgotten.
- **invoice → job → project (finding #4):** the link runs through the deprecated `jobs` table.
- **payment → QBO (S8):** the chain stops; the books don't close.

---

## Screen-briefing sequence (recommended)

Bookends done: **Contacts** (lead) ✓ and **Billing/AR** (invoice→payment) ✓. Projects-list + Inbox briefs also exist. The untrustworthy middle is unbriefed. Brief in path order, heaviest zone first:

1. **Quote builder / editor** (`/quotes` + editor) — S1. The contract is *made* here; everything downstream is its shadow. Carries the S3 conversion seam.
2. **Project Hub detail** (`/projects/[id]`) — S4. The structural middle, 10 sections, "where the work happens." Heaviest single screen.
3. **Change Order flow** (authoring + `/approve/[code]`) — S5. Currently folded into Budget; needs first-class authoring + the approval hand-off.
4. **Public approval / pay surfaces** (`/view/[id]`, `/approve/[code]`, `/view/invoice/[id]`) — S2/S7-external. Small but trust-critical; unify the id-vs-code inconsistency.
5. **Expenses / job costing** (`/expenses` + Spend tab) — S6.

(QBO/S8 is a **product decision**, not a screen brief, until the import-only question is resolved.)

## The heaviest segment to drill into now

**Estimate → Project execution** = **Quote builder (S1) → Project Hub (S4)**, with the **S3 conversion seam** between them. Recommendation: **brief the Quote builder first** (it defines the contract baseline the whole hub references), then the **Project Hub**. The Hub is the larger surface but it inherits its baseline from the quote, so quote-first avoids re-work.

---

## Open questions / decisions needed (before briefing the middle)

1. ~~**QBO (finding #2):** outbound sync vs import-only?~~ **RESOLVED — import-only is sufficient for V1; outbound parked for V2.** (See correction above.)
2. ~~**Quote→Project (finding #1):** auto-create on approval vs manual?~~ **RESOLVED — GC non-issue (project predates the estimate); applied only to the deprioritized PW path.** (See correction above.)
3. **jobs vs projects (finding #4):** is the GC redesign allowed to assume `projects`-only, or must briefs tolerate the live `jobs` path (esp. invoice `job_id`)?
4. **Public surface keying (S2/S7):** standardize quote + invoice public pages on `approval_code` (like CO), or accept id-keying?
5. **Helcim (finding #6):** is Helcim EFT still a V1 rail, or has manual Interac e-Transfer replaced it?
6. **The dead Henry insight strip (S4):** revive `getProjectInsights` into the unified Budget/Overview, or leave variance numbers as the only execution-time intelligence?
