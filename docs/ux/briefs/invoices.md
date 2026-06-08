# OD Brief — Billing / AR (project-grouped)

> **Grounded in:** `src/app/(dashboard)/invoices/page.tsx`, `invoice-table.tsx`, `invoice-status-badge.tsx`, `invoice-empty-state.tsx`, `record-payment-dialog.tsx`, `job-complete-invoice-prompt.tsx`, `lib/db/queries/invoices.ts` (`getProjectDrawSummary`), `lib/db/queries/dashboard.ts` (overdue logic), `lib/validators/invoice.ts`, `lib/ar/*` (follow-up engine), `lib/invoices/{totals,draw-gst-mode}.ts`, `status-tokens.ts` (`invoiceStatusTone`), PATTERNS.md §19/§21. **How to use:** paste into the OD project (HeyHenry "Paper" palette — deepened + the typographic-clarity discipline in DESIGN.md), generate hi-fi desktop + mobile, then run `heyhenry-design-critique`.
> **Current vs. target:** today this is a flat **unfiltered** list of invoice *documents* (no search/filter, 200-row cap), newest-first so **drafts bury the actionable rows**, with **no project context** and **no money summary** — the 5 identical Mohan drafts in the live data are the tell (the draw schedule isn't legible, so orphan documents pile up). This brief specifies the **target**: a **project-grouped Billing / AR cockpit** — a money summary that prompts the chase *and the next bill*, each **project as an expandable row** showing its billing position, drilling into the individual draws/invoices. **Flagged** where it differs from current.
>
> **Naming:** the screen's function is **Billing / AR**, not an invoice archive — rename the nav label "Invoices" → **"Billing"**. (Route stays `/invoices`; see open questions.)

**Primary object:** the **Project's billing position** (Invoices — `doc_type: invoice | draw` — grouped under their Project via Job) · **Roles:** owner / admin (bookkeeper later) · **Primary action:** bill the next draw · record a payment · chase what's overdue

## Purpose
The operator's **get-paid** surface. A reno GC doesn't think in invoice documents — they think in **projects and draw schedules**: *what's the contract, what have I billed, what have they paid, what's left to bill, what's overdue.* This screen answers that per project, prompts the next draw, and makes recording a payment or sending a reminder one tap.

## The data truth this screen must reflect
- **Every invoice belongs to a job → project** (`job_id` notNull, `project_id` nullable). Group by project; the project is the unit.
- **Two doc types:** `invoice` and **`draw`** (progress billing). A draw is a stage payment within a project's billing plan, not a one-off.
- **Lifecycle:** `draft → sent → paid` (or draft/sent → `void`). No **partial payments** — deposits/stages are *separate draw invoices*, not part-payments on one (fine; reflect it).
- **No `due_date`, no draw *sequence/plan*, no holdback in the model.** Overdue is **derived** (below). **Holdback is intentionally out of scope** — real GCs bake retention into their pricing/process, none track it formally (per founder input). Don't model or surface it.
- **Payment methods:** `cash · cheque · e-transfer · stripe · other` — **Interac e-Transfer is first-class, at parity with Stripe.**
- GST/HST carried per invoice (`tax_cents`, `tax_inclusive`). **GST *reports* live on the Expenses screen — do NOT duplicate a GST-collected total here.**

## The cockpit header — money that prompts action *(target — new)*
A compact summary strip, scoped to billing — **three numbers, each actionable**, none a vanity brag:
- **Ready to bill** *(highlight — the rust accent)* — earned-but-unbilled work across projects (completed jobs/milestones with no invoice, and/or remaining-to-bill on active projects). The proactive cash prompt. → jumps to the ready-to-bill projects.
- **Outstanding** — Σ `sent` (unpaid) totals — money on the street.
- **Overdue** — the aged subset (danger). → the chase list.
All **CAD, tabular-nums, de-emphasized cents**, owner/admin only. Nothing outstanding + nothing to bill → a calm "All caught up."
> **"Collected this month" / revenue is NOT here** — it's a *monitoring* number (you can't act on money already in the bank), so it lives on **Business Health**, not the AR worklist. And **Outstanding/Overdue must read the canonical AR helper** (see the AR single-source cleanup cards) — do **not** compute a fourth definition on this screen.

## Layout
- **Header:** "**Billing**" + subhead. **No header action button** — **Import-with-Henry is pulled off this screen**: it imports *historical* invoices (an onboarding/migration task), so it lives in the standalone **Import hub**, not the AR worklist. And no "New invoice" — invoices are *generated from a job/project* (kept in the empty-state guidance), never created blank here.
- **Cockpit strip** (above).
- **Filter bar (target — new):** status chips All · Draft · Sent · **Overdue** · Paid · Void; **search** (project / customer / invoice #). **Default view surfaces action** — ready-to-bill + open (overdue/sent/draft) projects first; paid-in-full projects collapse to the bottom or behind a filter. URL-state, mirroring the Contacts/Projects filter-bar pattern.
- **Project-grouped table — expandable rows:**
  - **Project row (collapsed):** Project name + customer · **billing position** → *Contract → Billed → Paid → Outstanding → Remaining to bill* (tabular, de-emph cents) · a status rollup chip (e.g. `1 overdue` · `ready to bill $X` · `paid in full`) · expand chevron.
  - **Expanded:** the individual **draws / invoices** for that project — doc-type tag (*Draw* / *Invoice*), mono `#id8`, amount + GST breakdown, status badge (incl. **overdue**), sent / paid dates, and the row action (**Mark paid** on sent — `RecordPaymentDialog`, PATTERNS.md §19; **Send reminder** on overdue). This is where today's flat invoice rows live — one level down.
- **Pagination (target):** server-side, by **project** (`range`/`offset` already supported on the invoice lister; the project rollup is the new query).

## The project billing position *(target — the core new structure)*
Per project: **Contract** (approved estimate + approved change orders) → **Billed** (Σ sent+paid) → **Paid** (Σ paid) → **Outstanding** (billed − paid) → **Remaining to bill** (contract − billed). `getProjectDrawSummary` already rolls up sent/paid/outstanding per project — extend it with contract + remaining. This is what makes a draw schedule legible and kills the orphan-draft problem.

## Ready to bill *(target — highlight; Henry proactive billing)*
The standout move: don't just track invoices that exist — **prompt the ones that should.** Surface projects where billable work is done but unbilled (the per-job `job-complete-invoice-prompt` already does this at the job level — roll it up across projects). Henry phrasing, decision-attached: *"Mohan rough-in's done — bill draw 3 ($12,400)?"* with a one-tap generate. Labeled as Henry, draft created for review (never auto-sent).

## Overdue — a derived status *(target)*
No `due_date`; reuse the rule the dashboard already computes — **`status='sent'` AND `sent_at` > 14 days ago** (`dashboard.ts`). Danger cue + age ("28d overdue") on the invoice; bubble an `N overdue` chip onto the parent project row.

## Henry intelligence
- **Ready-to-bill prompt** (above) — the primary embedded-intelligence win.
- **AR follow-up / chase** (real — `lib/ar/{executor,system-sequences,event-bus}.ts` + `henry-nightly` cron, CASL-aware): show per-overdue whether a reminder went out / is scheduled; let the operator trigger or hold a nudge (deferred-notify + Undo). Embedded intelligence at the get-paid leverage point — **not a chat box.** Label AI-sent reminders + make them cancelable.
- **Import with Henry** — **moved OFF this screen** to the standalone Import hub (historical-invoice import is onboarding/migration, not an AR action). Not a Billing touchpoint.
- **Drift / missing-GST notices** (real — `cost-basis-drift-banner.tsx`, `missing-gst-notice.tsx`): a quiet flag on affected invoices (detail-level); optional list-level count.

## Role variations
- **Owner / admin:** full Billing/AR — cockpit, ready-to-bill, reminders, record payment, void.
- **Member / crew:** **N/A.** Crew use the *worker invoice* surface (`/w/invoices`) for their own time/expense submissions — a different object (`worker-invoices`). Don't conflate.
- **Bookkeeper:** dedicated portal, not built — design owner/admin now, leave room.
- **Homeowner:** sees **only their own** invoice via the public portal (`/view/invoice/[id]`) to pay (Stripe / Interac) — never this list, never other customers, never cost/margin.

## Mobile vs desktop
- **Desktop:** cockpit + filter bar + project-grouped expandable table.
- **Mobile:**
  - **Cockpit** → the three numbers only (Ready-to-bill · Outstanding · Overdue) — no hidden 4th to scroll past. **Header:** title + search only (no Import button — it's in the Import hub).
  - **Collapsed project card:** name + customer · status-rollup chip (`Ready $X` / `N overdue` / `Paid in full` / `Draft`). Tap to expand.
  - **Expanded card MUST show both, in order** *(the v1 mock showed only the position — that was the bug)*: **(1)** the billing position (Contract → Billed → Paid → Outstanding → **Remaining**), then **(2)** the **draws/invoices list** — each row: doc-type (Draw N / Invoice) + amount + status badge (incl. **overdue + age**) + **its action** (Mark paid / Send reminder / Bill draw). Ready-to-bill projects show the Henry "bill draw N?" prompt + Bill-draw button.
  - **Sticky project header on scroll.** A long draw list scrolls the project title off-screen — but each draw row carries a *money action* (Send reminder / Mark paid / Bill draw), so the operator must always see *whose* money they're acting on. Pin a **thin header (project name + customer + rollup chip)** while within that project's draws, swapping to the next as you scroll past. Keep pinned chrome minimal — the **cockpit + filter row yield on scroll** (scroll away / collapse to a thin strip) so two thick bars never stack on a phone. Standard sticky-section-header pattern.
  - All actions **44px+** thumb targets. **Filters (Status / Sort) → a single sheet control, NOT a horizontal scroll-row** (PATTERNS.md §9 — mobile = native select). Honor grid-cols-1 + `min-w-0` (PATTERNS.md §18).

## Financial / Canadian
- **GST/HST breakdown** per invoice (in the expanded rows; de-emph cents). Flag `missing-gst-notice` where absent. **No GST-collected total here** — that's the Expenses GST reports.
- **Interac e-Transfer at parity with Stripe** — in record-payment (exists) and in how the customer pays; show the method on paid rows.
- **CAD** throughout, tabular-nums.
- **No holdback** (out of scope — see data truth). **No T5018** here (sub/vendor-side).

## States
- **Empty (fresh):** keep the Receipt-icon empty state, Henry voice — "Complete a job and generate an invoice to start getting paid." (restyle to Paper).
- **Filtered-empty (new):** "No projects match these filters." + clear-filters.
- **All caught up:** nothing outstanding + nothing ready to bill → calm positive state.
- **Loading:** skeleton (exists — `invoices/loading.tsx`).

## Visual identity
Deepened **Paper** palette: white card table on paper, solid warm hairlines, ink text, **mono `#id8`** as a labeling device. Status badges via `invoiceStatusTone` (draft = neutral, sent = info, paid = success, void = neutral) — already on the token system, **no rainbow problem**; add **overdue = `danger`**. **Rust is the single accent** — reserve it for **Ready to bill** (the proactive money prompt) + the primary action; overdue uses danger red. Expandable project rows (chevron, calm). Tabular-nums + de-emphasized cents on every money value. **Three type sizes max.**

**Henry prompts** carry consistent *chrome* — the ✦ **"HENRY"** label + a thin **rust left-border** + **rust reserved for the action button** ("Bill draw — $18,000"). The **fill reflects the prompt's meaning**: a **ready-to-bill** prompt (like this one) uses the **rust-soft peach `#FEF0E3`**, matched *exactly* to the Ready-to-bill cockpit card + chip so the "ready to bill" language reads as one warm family; a generic heads-up (e.g. the **Contacts duplicate banner**) stays **neutral/white**. **Never a danger-red fill** (`#FEE2E2`) on a *positive* nudge — red codes as an alarm. So: peach here (it's ready-to-bill), white on the dedupe banner; rust always on the action, never the container.

## Subscreen inventory
The Billing/AR list. One heavy subscreen **graduates to its own row/brief**.

**Graduate → its own brief (flag for a new pipeline row)**
- **`/invoices/[id]`** — the invoice **detail / draft** page: line editing · note · payment terms · the **customer-view override editor** (`invoice-overrides-editor` — §25 live "what the client sees" preview: lump-sum / sections / categories / detailed + mgmt-fee-inline toggle) · send · mark-paid. Substantial enough to be its own screen (vault plan: "Invoice customer-view preview screen").

**Modals / dialogs**
- **Record-payment** (`record-payment-dialog`, §19) — mark a draw/invoice paid: amount · method (**Interac at parity with card**) · date.

**Sub-flows**
- **New draw / milestone** — `Draw #N` default → `createMilestoneInvoiceAction` (live GST preview); **Invoice full estimate** (gated on approved); **Generate final** (cost-plus vs fixed).
- **AR follow-up** — the `lib/ar/*` chase engine; overdue = `sent` > 14d.
- **`/invoices/import`** — QBO import (V1 import-only).

**Expansion / disclosure**
- Project-grouped rows expand to their draws / invoices; per-row status + "Drawn to date $X of $Y".

**Sub-routes (graduate → Public pages, `research-0523`)**
- `/view/invoice/[id]` — public customer invoice view + pay surface.

## Accessibility
WCAG 2.2 AA: near-black ink on white; never color-only for status/overdue (pair danger with a label + age); expand/collapse is keyboard-operable with proper `aria-expanded`; rows/links have focus order; ≥44px hit targets for Mark paid / Send reminder / Bill draw on mobile; cockpit numbers reachable and the Overdue / Ready-to-bill figures are real buttons (jump to their filtered view).

## Open questions
- **Name + route** — nav label → "Billing" (agreed). Rename the route `/invoices` → `/billing` too, or leave the route and just change the label? (Route rename = redirects + link updates; label-only is cheaper.)
- **Contract value source** — "Contract = approved estimate + approved change orders": confirm the exact query (estimate total + `change_orders` approved sum) and that it's cheap per project.
- **Ready-to-bill trigger** — completed-job-without-invoice (reliable, exists) vs earned-value (contract × % complete − billed). Lean: start with the completed-job signal; add earned-value later.
- **Draw sequence** — "Draw 2 of 5" needs a planned schedule the model doesn't have; `getProjectDrawSummary` only has totals. Derive a running index from existing draws, or defer the "of N"?
- **Bookkeeper** role timing (portal not built).
