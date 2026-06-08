# OD Brief — Project Hub (the execution workspace)

> **Grounded in:** `src/app/(dashboard)/projects/[id]/page.tsx` (the shell — header, tab IA, lifecycle-default-tab, per-tab streaming), `tabs/overview-tab-server.tsx` (VarianceSection + ProjectFactsSection + TimelineSection), `tabs/costs-tab-server.tsx` + `costs-tab.tsx` + `costs-subtabs.tsx` (Spend), `tabs/invoices-tab-server.tsx` + `invoices-tab.tsx` (Billing), `tabs/time-tab-server.tsx` (Labour), `tabs/{schedule,messages,gallery,portal,selections,documents,memos,crew}-tab-server.tsx`, `budget-summary.tsx` (`VarianceTab`), `unsent-changes-chip.tsx`, `scope-diff-review.tsx`, `applied-co-banner.tsx`, `project-timeline.tsx`, `project-intake-zone.tsx`, `project-name-editor.tsx`, `percent-complete-editor.tsx`, `management-fee-editor.tsx`, `billing-mode-editor.tsx`, `henry-insight-strip.tsx` + `getProjectInsights` (**now BUILT/wired on Overview as of PR #268 — see Henry**); `server/actions/project-assignments.ts` (`assignWorkerAction` — owner/admin only; nullable per-job rate overrides); queries `getVarianceReport`, `getBudgetVsActual`, `getProjectDrawSummary`, `getProjectProgress`, `getUnsentDiff`/`getLatestSnapshot`, `getProjectChangeOrderContributions`; migrations `0051_worker_profiles.sql` (`default_hourly_rate_cents`), `0054_pay_and_charge_rates.sql` (`default_charge_rate_cents` on workers; `charge_rate_cents` on assignments), `0052_project_assignments.sql` (`scheduled_date` nullable), `0097` (lifecycle_stage). Vault: Project Hub Spec `6c0de27d`, Object Model `b4d880be`, Role Matrix `03b1ccf4`, IA/Nav `6529e9ae`; `docs/ux/sacred-path-map.md`. **Reconciled 2026-05-22 against vault current-state (evergreen, auto:doc-writer): Module: Project Budget tab `9ed92291`, Module: Project Hub redesign `346596b3`, Module: change-orders `00f93790`; and `GC_WORKFLOW_PLAN.md` (worker-app plan W1–W7). Several "target/new/DEAD" labels below are now BUILT in code (PR #268) — flagged inline; design still leads the remaining refinements.** Siblings: **`briefs/estimate.md`** (the SAME Budget table, authoring face), **`briefs/invoices.md`** (the cross-project Billing/AR list), **`briefs/customer-documents.md`** (the homeowner-facing docs the Client hub manages), **`briefs/projects-list.md`** (entry point).
> **How to use:** paste into the OD project (HeyHenry "Paper" palette — deepened + the clarity discipline in DESIGN.md), generate hi-fi desktop + mobile, then run `heyhenry-design-critique`.
>
> **Shared-component constraint.** The **Budget tab is one component** in two postures. `estimate.md` specs its **authoring** face (pre-approval: build + price scope); this brief specs its **execution** face (post-approval: track actuals). They reconcile into a **single state-adaptive table**, switched by `estimate_status`/`lifecycle_stage` — not two designs.
>
> **Persistent-header principle (governs this rewrite).** This header sits on top of *every* project tab. So it carries **identity + state + wayfinding only — never a metric a dedicated page already owns.** Margin lives on Overview/Budget; draws on Billing. Putting a cockpit on every page is the "duplicate-metric-row" smell. (A reusable rule: *persistent chrome carries level-appropriate identity; it never duplicates a dedicated surface.*)
>
> **Current vs target:** the Hub is built and deep, but the chrome sprawls — a header that stacks identity + a 7-pill secondary-nav row + Versions + a naked trash icon, **navigation split across two rows** (secondary in the header, primary below), 13 tab destinations, and scattered editable project attributes (name in the header, mgmt-fee/billing/dates in Overview's "facts grid"). Target: a **lean identity-only header** with a **Project Details card** for the editable attributes; **one unified nav** trimmed from 13 → ~9 by grouping (Client hub) and relocating (Crew, Notes); clearer names (**Time→Labour**, **Customer Billing→Billing**); Overview freed to be a real **"what needs you" cockpit**; and the execution-posture Budget/Spend/scope-diff fixes. **Flagged** where target differs.

**Object:** the **Project** in execution (`projects` active+, with its budget / costs / labour / invoices / scope-diff / crew / field capture) · **Roles:** owner / admin / member (full); worker (assigned field capture, separate `/w`); homeowner (portal only) · **Primary action:** know if the job is on-track and on-margin, and do the next thing that keeps it moving.

## Purpose
The operator's **run-the-job** workspace. Per the Project Hub Spec: *"NOT a miniature Procore… the smallest reliable surface that keeps the job moving, protects margin, and captures the truth from the field."* The **Overview** tab is the cockpit ("am I making money, what's changed since they signed, what can I bill, what needs me today"); the header is just calm identity chrome that's true on every tab.

## The data truth this screen must reflect
- **Lifecycle drives posture** (`0097`): `planning → awaiting_approval → active → on_hold → complete | cancelled` (+ `declined`). `active`+ = execution; the Hub lands on **Overview**, the Budget table renders collapsed + actuals-forward.
- **Budget-vs-actual** (`getBudgetVsActual`/`getVarianceReport`): `estimate` (Σ priced lines) − **spent** (labour from `time_entries` + bills + expenses from `project_costs`, **pre-tax**) − **committed** (accepted sub-quotes + active POs) = **remaining**. **`margin_at_risk = estimated_revenue − actual − committed`** (revenue = scope subtotal + management fee). Negative = danger.
- **Approved estimate = the contract baseline.** Post-approval scope edits are diffed against the latest signed snapshot (`getUnsentDiff`); each change is `henry_suggests: send_as_co | internal`. The hub never silently rewrites the contract.
- **Crew = `project_assignments`** (project_id, worker_profile_id, **`scheduled_date` nullable**, `hourly_rate_cents`, `charge_rate_cents`, notes; unique on project+worker+date). **`scheduled_date IS NULL` = ongoing crew (the roster); a set date = a scheduled day (the grid).** Roster and schedule are one table split by that column.
- **Workers carry account-level default rates** — `worker_profiles.default_hourly_rate_cents` (pay) + `default_charge_rate_cents` (charge). The per-assignment rates are **nullable overrides** (null = inherit the worker's default).
- **Billing is draw-based** (`doc_type` draw/invoice/final; no partial payments; no holdback; overdue = `sent` + `sent_at` > 14d). Cost-plus (`is_cost_plus`) vs fixed-price governs the final invoice.
- **Field truth = photos + worklog + memos + time** (no "daily log").

## The two postures (Budget tab)
- **Authoring** (`estimate_status` draft/declined, pre-approval): build + price scope — columns Category · Estimate · Margin; execution columns dormant. *(Specced in `estimate.md`.)*
- **Execution** (`approved`, active+): the same table, actuals-forward — **Spent · Committed · Remaining + progress bars** wake up; CO chips + "spent by source" appear; sections default collapsed. *(This brief.)*

## The shell — header + nav *(target — lean identity, one nav)*
Keep the streaming architecture (header paints <100ms; tabs stream). The header does **two jobs only — orient and navigate:**
- **Identity row (one line):** inline-editable name + a **`▾` chevron** that opens the **Project Details card** (below) + the **lifecycle status badge** (`✓ Active`, via `status-tokens.ts`).
- **Customer (quiet, secondary, linked):** keep it — it's *identity* ("the Mohan job") and a one-tap path to call/email the homeowner from any tab — but as a small muted line, not a bold one. (It's identity, not a metric; if the header ever still feels heavy, it can move into the Details card.)
- **`✦ Add` (ghost):** the `ProjectIntakeZone` capture front door (drop the mess → Henry files it: receipts→costs, photos→gallery, sub-quote PDFs→sub-quotes, texts→scope). A **light ghost button** that opens the drop target — not a heavy black button competing with the global "New Project."
- **`⋯` overflow:** Versions, Delete, Duplicate. Kills the dangling, label-less trash icon (a11y + accident risk).
- **No metrics in the header.** No % complete, no margin/draws strip — those live on Overview/Budget/Billing. (% complete moves to Overview; if an always-on cue is ever missed, the lightest option is a thin hairline progress line under the title — don't add it pre-emptively.)
- **Alerts are NOT full-width banners in the header** — they follow the §"Alert surfacing model" below (a chip on the owning tab, a count badge on that tab's label, and a row in the Overview "Needs You" aggregator). `UnsentChangesChip` / `StagedEmailsBanner` become chips/badges, not a persistent bar. (The "Electrical dates locked: Mar 24–27" line moves to **Schedule** — it's a schedule fact, not header furniture.)
- **One unified nav** (the path-efficient fix): the tab bar is the *only* place to navigate — no separate header-actions row of destination pills. Primary tabs prominent; the grouped/secondary set lighter or behind **"More ▾"**, badges preserved. Mobile = the `<select>` (`ProjectTabSelect`).

```
[<]                          🕐 Log time   $ Log Expense   [+ New Project]   Northbeam Construction ⇕
Glenwood Heights Master Suite Addition ▾    ✓ Active                    ✦ Add    ⋯
Daniel & Priya Mohan                                                    (quiet, linked)
──────────────────────────────────────────────────────────────────────────────────────
Budget   Spend   Labour   Schedule   Billing   Overview            Client²   Photos   Documents
```

## The Project Details card *(BUILT 2026-05-22 PR #268 — `project-details-card.tsx` + `crew-roster.tsx` (crewSlot); the facts-grid→card move is done; now refine)*
Clicking the name's **`▾`** opens a popover (desktop) / sheet (mobile) holding the **editable project-level attributes** — consolidating what's scattered today (inline name edit in the header + Overview's "facts grid"):
```
┌ Project details ───────────────────────────────── ┐
│ Name        Glenwood Heights Master Suite Addition ✎│
│ Customer    Daniel & Priya Mohan ↗                  │
│ Description Master suite addition over garage… ✎    │
│ Dates       Mar 3 → May 30 (target) ✎               │
│ Billing     Cost-plus · Mgmt fee 18% ✎              │
│ Status      ✓ Active                                │
│ ── Crew ────────────────────────────────────────── │
│  ☑ Mike Reyes     $52/hr pay · $80/hr charge   ⌄    │
│  ☑ Dave T. (sub)  sub-trade                    ⌄    │
│  + Add crew                                         │
└─────────────────────────────────────────────────────┘
```
- **It becomes the project-settings home that doesn't exist today** — and lets us **delete Overview's facts grid**, freeing Overview to be a cockpit.
- `▾` = details/attributes (view + edit); `⋯` = actions (Versions/Delete/Duplicate). Two clear meanings.

### Crew (in the Details card) — roster only, simplified
*(This is the project-level half of the old "Crew" tab; scheduling is separate — see below.)*
- **Assignment = a multi-select checklist** of the tenant's workers + subs (not a one-at-a-time form). Each row shows the worker's **account default rate** (`default_hourly_rate_cents` / `default_charge_rate_cents`) read-only/muted, so the operator sees what they're paying/charging. Tick → **Add to crew** (writes `project_assignments` with `scheduled_date = null`, rate overrides null = inherit).
- **Override on demand:** a per-row **`⌄`** expands pay-override / charge-override / note — only when *this job* pays or charges someone differently (writes the nullable `project_assignments` rates; blank = inherit). This replaces today's always-shown 4-field form, which surfaced the rarely-needed override as prominent empty fields.
- *Build check:* confirm the assign action **reads the worker default when the override is blank** (the variance RPC already `COALESCE`s `hourly_rate_cents`) so labour costing is correct on inherited rates.
- Owner/admin only (`assignWorkerAction` asserts it).

## Tab IA *(target — 13 → ~9, one bar)*
**Primary (the work):** `Budget · Spend · Labour · Schedule · Billing · Overview`
**Grouped/secondary:** `Client² · Photos · Documents`
- **Renames (label-only — keep route keys, like Invoices→Billing):** **Time → Labour** (it's labour hours + worker invoices; de-collides from Schedule = *actuals* vs *plan*; matches the `material·labour·sub·equipment·overhead` cost vocabulary; Canadian spelling, the *u*). **Customer Billing → Billing** (resolves the "Client" collision).
- **Spend keeps its name** (not "Expenses" — that collides with the standalone Overhead-Expenses screen and is too narrow for committed POs/sub-quotes/bills). With Labour split out, **Labour = internal hours, Spend = external money out** — a clean pair.
- **Client hub (new grouped tab):** the homeowner-relationship surfaces as subheads — **Messages · Selections · Portal & Updates** — plus curating *what the client sees* (which photos/docs are shared). It's the operator-side mirror of the customer portal, and the home for the Henry **Pulse** client-update once wired (see Henry). Default it to **Messages** (most-used) and put the **unread badge on the `Client` tab** so you see "²" without entering. (Trade-off accepted: grouping adds a click; the default + badge mitigate it.)
- **Don't fold internal/library surfaces into Client:** **Photos** stays its own surface (internal-first capture + before/after/concern tagging + the portal-visible flag; Client just curates the shared set). **Documents** stays (internal store + Home Record; client-facing docs surface in Client). **Notes** is internal → **fold into Overview's activity feed** (target — confirm). **Crew** → the Details card (roster) + the dispatch board (scheduling).
- Net: **removes** tabs (passes the reject-if rule), groups by mental model, and resolves the 13-tab sprawl.

## Overview = the cockpit *(BUILT 2026-05-22 PR #268 — `tabs/overview-tab-server.tsx` streams HenryInsightStrip → VarianceSection → TimelineSection; now refine, not propose)*
Today Overview = a variance card + a **facts grid** (start/end/mgmt-fee/billing/#categories — **moves to the Details card**) + a timeline. Target:
- **A "Today / Needs attention" strip on top** — a ranked **"do this" list (not a wall of stats)**: margin at risk, N unsent changes (customer-impacting), draw ready to bill (peach), overdue draw (danger), schedule slip, unread client messages/ideas, missing receipts/unpaid bills. Each = one-line statement + one-tap action; when nothing's wrong it collapses to a calm "On track — nothing needs you." **Revive the dead `getProjectInsights`** (over/under-budget · unsent-changes · on-track rules — built, wired nowhere) as the engine.
- Below: the **variance/margin** card (`VarianceTab`) and the **activity feed** (the timeline, now also absorbing the internal **Notes**). This is where the numbers the header *doesn't* duplicate actually live.

## Alert surfacing model *(target — how multiple alerts behave across tabs)*
Project alerts (margin-at-risk, unsent changes, ready-to-bill, overdue draw, client message, missing receipts, schedule slip…) surface in **three layers — never as stacked full-width banners**:
- **Overview "Needs You" strip = the aggregator** — *all* of the project's alerts in one place, severity-ranked by Henry, capped ~4 + "+N more", one row per alert type, each linking to its owning tab. Empty → "On track — nothing needs you."
- **Tab-label badges = per-tab counts** — each alert is owned by the tab where it's resolved; a count badge on that tab's label (e.g. `Budget² · Billing¹ · Spend¹ · Client²`) tells the operator, from *any* tab, where the work is. **On mobile** the nav collapses to a select, so the badge layer moves there: the select **trigger** shows the total (e.g. `Overview ▾ · 5`) and each **dropdown option** carries its own per-tab count; desktop keeps the inline row badges. Keep the three counts consistent — strip "N today" = trigger total = Σ per-tab badges.
- **Inline on the owning tab = where you act** — compact **chips** in a small alert region (a tab may carry two or three); never stacked banners.
- **Critical escalation (one signal):** a can't-miss item (margin blown, badly overdue) may tint the header **status badge** with a single quiet severity cue — resolved on Overview. Never a banner, never a stack.
The standalone top banner is retired: `UnsentChangesChip` becomes a chip on Budget + a `Budget` badge + a row in the Overview strip; `StagedEmailsBanner` follows the same model.

## Budget — execution posture
The estimate table, now actuals-forward: **Spent · Committed · Remaining** + multi-segment **progress bars** live; **CO chips** on touched categories; the **"spent by source"** strip (Labour/Bills/Expenses → deep-links to Labour/Spend); per-line actuals expand. `AppliedChangeOrdersBanner` anchors the top. Move raw `red-600`/`amber-600`/`green-500` onto `status-tokens.ts` soft pairs + token progress colours; collapse the ~6 font sizes to three. Sections default **collapsed** in execution.

**Reconciliation — terminology (do NOT ship the code's current label).** The Budget components currently render **"Projected Cost"** (relabel `6d48baa`, live in `budget-summary.tsx` + `budget-categories-table.tsx`) where this brief says **Committed** — and **"General Overhead"** for **Overhead**. Keep **"Committed"** / **"Overhead"**: *Projected Cost* properly means *Estimate at Completion* (a forecast = actual + cost-to-complete), a different concept; using it for "accepted sub-quotes + open POs" is a mislabel. The code relabel should **revert**. It's label-only — the data fields (`committed_cents`, `committed_vendor_quotes_cents`) already keep their names. *(Source: vault Module: Project Budget tab `9ed92291`.)*

**Reconciliation — delete safety (data truth the table must respect).** Deleting a budget category must **explicitly clear its `project_cost_lines` first**: the FK is `ON DELETE SET NULL`, so orphaned lines otherwise resurface under the **"Other work"** header on the **customer-facing** estimate — i.e. deleted scope reappearing on a sent document (fixed in `ab36268`). Any delete affordance this table exposes inherits that gotcha. *(Source: same vault doc.)*

**Table structure — one aligned grid (refined this round):**
- **The 4-column grid (Estimate · Spent · Committed · Remaining) holds top-to-bottom** — section → category → line, one *shared* column grid (NOT a nested sub-table with its own widths), so every value sits dead under its header and you can scan straight down any column. **Sticky column headers** stay visible while scrolling into line detail. *(Principle: category rows and line rows share the grid — the financial breakdown is consistent at every level; don't give lines a separate layout.)*
- **Collapsed section rows** lead with the section **Estimate**, then **"% used"** (= spent + committed ÷ estimate) + an over-flag when >100% — never spent-$ beside a consumed-%.
- **Per line:** Estimate (line price) · Spent · Committed · **Remaining (= Estimate − Spent − Committed)**, right-aligned to the same edges, summing up to the category row. A not-started line shows its full price as Remaining (not $0). Line state is conveyed by *which column* holds the value, so desktop drops the SPENT/COMMITTED/PROJECTED text tag (mobile keeps it — no columns there).
- **Alert de-dupe:** the Margin-at-risk chip stays high-level; the in-table section flag (e.g. "FRAMING OVER $4,800") carries the specific — don't name the same item in both.
- **Mobile:** table → stacked category cards; the section single-number row uses "Estimate · % used · flag"; alert chips are single-line.

## Scope-diff / unsent-changes — the contract-protection spine
On approval (+ each CO apply) the scope is snapshotted; later edits are diffed (`getUnsentDiff`, classified `send_as_co | internal`). **`UnsentChangesChip`** (below the header): *"N unsent changes since v{N} · ±$X · M look customer-impacting"* → opens **`ScopeDiffReviewClient`** (`?review=diff`): per-row **Revert to last signed**; footer **Create Change Order** (`createChangeOrderFromUnsentDiffAction` → the CO editor — see `change-order.md`). Fix the stale modal copy ("send the rest as a CO from the Changes tab" — the button creates it inline). Add a **"notify customer (non-billable)"** path for internal-but-visible changes (routes to the portal update, distinct from a billable CO).

## Spend — the procurement / AP workflow (NOT a Budget clone)
The project's **external money-out** surface, and it's a *workflow* — organized **By type** (Vendor quotes · POs · Costs; default landing = **Costs**) with a secondary read-only **By category** reconcile lens. Budget = plan-vs-actuals; Spend = procure → commit → bill → pay. Share **shell + palette only** with Budget. Grounded in `costs-tab.tsx`, `sub-quotes-section.tsx`, `project-costs-section.tsx`, `purchase-orders.ts` (2026-05-22).
- **Summary = 3 cells: Committed · Billed · Paid** — Committed carries an inline `(quotes $X · POs $Y)` breakdown and reconciles with `getVarianceReport.committed_cents`. *(The old "PO'd" silo + the "Paid = expenses-total" bug are already fixed in code.)* Target: surface **Unpaid** (Billed − Paid) as the rust actionable ("what you owe").
- **Vendor quotes = the distinctive Henry flow (the centerpiece — don't flatten it).** **"Upload quote"** OCRs a sub's PDF (`parseSubQuoteFromFileAction`, `gpt-4o-mini`) → a **"Review vendor quote"** Henry-prefilled dialog → operator allocates the quote's lines to **budget categories** (`Allocated $X / $Y`, balanced = emerald) → **Accept** (enabled only when balanced) flips it to `accepted` → counts as committed (auto-supersedes prior accepted quotes from the same vendor). Unmatched lines surface a **"no matching category"** note. States: pending_review / accepted / rejected / superseded / expired.
- **Costs (default) = bills + expenses,** entered via the **"Did you pay this already?" gate** (receipt vs vendor bill). Status: Paid receipt / Vendor bill·Unpaid (→ Mark paid) / Vendor bill·Paid; filter All/Unpaid/Paid; GST 5% auto + override; category + line-item selects.
- **POs = lifecycle list** (draft→sent→acknowledged→received→closed via "Mark {next}"); open POs count toward Committed. **Gap (target):** the PO form has **no budget-category picker** → POs are created uncategorized; add one so they reconcile + show in By-category.
- **By category** = read-only reconcile lens (KindChip per row; accepted quotes + open POs + bills + expenses; "Uncategorized — needs a category" block; honors `?focus` from Budget). The one true tie to Budget.
- **Henry (built) = the sub-quote OCR + category-allocation only.** Receipt-OCR, auto-categorize, and a missing-receipt nudge are **NOT built** — target enhancements, don't assume them.
- Paper + `Money` + token chips; rust reserved for the primary actions + the ✦ on "Upload quote".
*(Lesson: this section was first mis-specced as a Budget clone — grounded against the real `costs-tab` + sub-quote pipeline on the redo.)*

## Labour (was "Time")
Labour hours (`time_entries`) + worker invoices, by worker, at the assignment's pay/charge rate — rolling into budget actuals (`getBudgetVsActual` labour). Restyle to Paper + `Money`; show approve-hours flow; this is the **internal** money-out tab paired with **Spend**. (Rename is label-only; route key stays `time`.)
- **Grounded in the worker-app plan** (`GC_WORKFLOW_PLAN.md` §Worker app, phases W1–W7). The owner-side Labour tab mirrors the worker `/w` surface: **W3** logs `time_entries` (worker self-edits ≤24h, then owner-only) and the tab carries a **"by worker"** filter; **W6** is the **`worker_invoices`** queue — a sub builds an invoice from unbilled time + expenses → submits → owner **approves / rejects / marks paid** (the cross-project queue is `/invoices?view=worker`). So the brief's "approve-hours flow" is really *two* things: time-entry visibility/adjustment **and** the worker-invoice approval.
- **Two paths into budget actuals — don't double-count.** Raw `time_entries` cost at the **pay** rate flow to `getBudgetVsActual` labour directly; an **approved `worker_invoice`** (W6, plan Open-Q#4) is intended to auto-create a `project_cost_line` tagged `source='worker_invoice'` with a back-reference. The tab must show labour cost **once** — surface logged hours vs. the invoiced/approved amount without summing both. *(Charge rate = what the job is billed; pay rate = what the worker is paid — the per-assignment nullable-override model from the Crew section, mig `0054`.)*

## Billing (was "Customer Billing")
Project-scoped billing — **Draws** (`doc_type=draw`: Label · Status · % Complete · Total · % of Contract + "Drawn to date $X of $Y") + **Invoices** (final + legacy). Actions: **+ New draw** (`createMilestoneInvoiceAction`, live GST preview), **Invoice full estimate** (gated on approved), **Generate final**; per-row **Mark paid** (`RecordPaymentDialog`) + **View** (→ shared `/invoices/[id]`). Dovetail `invoices.md`: same `RecordPaymentDialog`, same draw vocabulary, the **peach "Ready to bill draw N — $X?"** Henry prompt, legible "Draw 3 of 5."

## Photos · Documents · Schedule (secondary/work tabs)
- **Photos** — before/after/progress/concern library; upload + auto-tag (`acceptAiTagAction`); portal-visible flag drives what Client shares.
- **Documents** — internal file store + **Home Record** generate/email + trade contacts; client-facing docs surface in Client.
- **Schedule** — the job's **work timeline** (phases/tasks/dates); the as-built **v2 Gantt** — drag-to-reschedule, edge-resize, click-to-edit, predecessor edges with forward-only auto-cascade, phase classifier (the old **"v0 read-only / no CPM"** label is obsolete — code shipped past it). **Not crew scheduling** — that's single-homed at **`/calendar`** (`calendar.md`); Schedule carries only a **read-only "crew on this job this week"** card deep-linking there. The "Electrical dates locked" cue belongs here. *(Full spec: `schedule.md`.)*

## Crew scheduling — a cross-project surface (BUILT — `/calendar`, see `calendar.md`)
Crew **scheduling** (who's on which site which day = `project_assignments` with a set `scheduled_date`) is inherently **cross-project** — a worker is one body across all jobs. It now lives in a **single home: `/calendar`** (account-level; three pivots — month / two-week / by-worker), which **feeds** from the project roster. The project Schedule tab keeps only a **read-only "crew this week" card** that deep-links to `/calendar?view=by-worker&project=…` — **no write-back** (the per-project dated grid was deleted to kill that duplication). *One model, one editing home — see `calendar.md` decision #4.*
- **Status (2026-05-22):** the **roster** (Details-card checklist, `scheduled_date` null) is built; the **dispatch board landed at `/calendar`** (by-worker pivot — PRs #270–#274) and has **its own brief** (`calendar.md`). The orphaned per-project crew grid was **deleted** (#269). Schedule stays the **work-timeline Gantt**, not a crew surface.
- **Reconciliation vs the plan** (`GC_WORKFLOW_PLAN.md`, 2026-04). The plan put crew on a **`?tab=crew`** tab (assign + a workers×14-day schedule grid + "who logged what"). Two deliberate divergences since: (1) the **roster** moved into the **Details card** (`crew-roster.tsx`, built) — there is **no Crew *tab***; (2) the plan's single `hourly_rate_cents` predates the **pay/charge split** — mig `0054` added `default_charge_rate_cents` (worker) + per-assignment `charge_rate_cents`, and the plan's sketch `0051_worker_profiles_and_assignments` shipped split as `0051`/`0052`. The brief's dual-rate roster is the as-built truth; the plan's schedule grid became the **`/calendar` by-worker dispatch board** (`calendar.md`), not a per-project grid.

## Henry intelligence (built · dead · gap)
- **Built/live:** `VarianceTab` margin numbers; the **scope-diff** with `henry_suggests`; intake classify-and-file (`ProjectIntakeZone`); photo auto-tag.
- **BUILT (2026-05-22, PR #268 — was the brief's #1 ask):** `getProjectInsights` is revived and `HenryInsightStrip` is mounted on Overview (`tabs/overview-tab-server.tsx` imports + renders it) as the **"what needs you" attention strip** — the engine the §Alert surfacing model rides. *Remaining design delta:* tune the ranked rule set, the "+N more" cap, and the calm empty state; confirm it lives on Overview only. (Source: vault Module: Project Hub redesign `346596b3`.)
- **GAP — wire Pulse to the project:** the Henry **auto-drafted client update** (`draftPulseAction`/`approvePulseAction` — Henry drafts a progress update from project activity → operator approves → sends SMS/email) lives **only on the legacy jobs surface**. The project hub has only the *manual* `PortalUpdateForm`. Bring Pulse into the **Client hub** (Portal & Updates). Henry drafts; operator sends; never auto-send.
- **Henry-prompt chrome** where it appears: ✦ HENRY + rust left-border + rust action; **fill = meaning** (peach = ready-to-bill/positive, warn-soft = caution, danger-soft = at-risk, never danger-red on a positive). Crew default rates are plain inherited data, not a Henry surface.

## Role variations
- **Owner / admin / member:** full Hub incl. cost/margin/spend/labour. (Crew assignment is **owner/admin only** — `assignWorkerAction`.)
- **Worker:** field capture only, assigned projects, via `/w` — never margin/costs/billing/other projects.
- **Homeowner:** the public **portal** only (the Client hub is the operator-side mirror) — never the Hub; never cost/markup/margin.

## Mobile vs desktop
*"Mobile = doing work; desktop = thinking work."* Overview is critical on both.
- **Desktop:** full cockpit + dense Budget/Spend/Labour tables + multi-line authoring/reconciliation; Details card as a popover.
- **Mobile:** glance the **cockpit attention strip + status badge**, **capture** (`✦ Add` drop-zone, photos, voice), check Schedule, log Labour, fire quick actions (mark a draw paid, approve a Pulse draft, answer a message). Dense tables → stacked cards; tab nav = `<select>`; Details card → a **sheet** (incl. the Crew checklist); diff-review/send → bottom sheets.

## Financial / Canadian
**CAD**, tabular-nums, de-emph cents via `Money` everywhere. **GST/HST** province-aware on draws/finals; **management fee** = the cost-plus markup; cost-plus vs fixed-price (`BillingModeEditor`, now in the Details card) governs the final invoice. **No holdback.** WCB/place-name texture.

## States
- **Just approved (entering execution):** Overview cockpit, calm attention strip, budget collapsed/actuals-forward, baseline = "Original estimate."
- **In flight:** attention strip populated; unsent-changes chip when scope diverges; draws billed.
- **At risk:** margin-at-risk negative → danger at the top of the strip + the lifecycle/health read on Overview (not the header).
- **Complete / closeout:** final invoice; Home Record; gallery; final paid.
- **On hold / cancelled:** muted; clear status badge; actions gated.
- **Loading:** per-section skeletons (keep).

## Visual identity
Deepened **Paper**; white cards on warm paper; solid hairlines; near-black ink. The **header is calm identity chrome** — name + status + quiet customer + one ghost action + an overflow; no metric furniture. **Three type sizes (16/14/12)** + the ink ramp. **Rust is the single accent** (primary CTA + Henry actions); status/over-budget via `status-tokens.ts` soft pairs. **Henry prompts** carry the chrome + fill-reflects-meaning rule. Money right-aligned, tabular, de-emph cents. Mono-uppercase eyebrows for metric labels (on the pages that own them).

## Subscreen inventory
The Hub shell + the three tabs without a standalone brief (Spend · Labour · project Billing). Budget→`estimate.md`, Schedule→`schedule.md`, Client→`client.md`, Overview→`overview.md` carry their own inventories.

**Shell (on every tab)**
- **Project Details card** (`▾`, `project-details-card`) — popover (desktop) / sheet (mobile): name · customer↗ · description · dates · billing mode + mgmt-fee (`billing-mode-editor` / `management-fee-editor`) · status · **Crew roster** (`crew-roster` — multi-select workers/subs + per-row pay/charge override). Inline editors (§4).
- **`⋯` actions menu** (`project-actions-menu`) — Versions · **Duplicate** (`clone-project-dialog`) · **Delete** (`delete-project-button`, §3 AlertDialog + NEXT_REDIRECT).
- **`✦ Add` intake zone** (`project-intake-zone`) — drop receipts / photos / sub-quote PDFs / texts → Henry files them (cost / gallery / sub-quote / scope). Capture front door.
- **Alert chips** — per-tab compact chips + tab-label badges (the §Alert-surfacing-model layers).

**Budget tab (execution) — modals**
- **Scope-diff review** (`scope-diff-review` / `ScopeDiffReviewClient`, `?review=diff`) — per-row Revert-to-signed; footer **Create Change Order** (→ `change-order.md`). **Applied-CO banner** anchors the top. (Authoring-side line editors → `estimate.md`.)

**Spend tab (procurement / AP — no standalone brief)**
- **Upload quote → Review vendor quote** (`sub-quote-form` + `parseSubQuoteFromFileAction`) — ✦ OCR a sub's PDF → Henry-prefilled dialog → **allocate lines to budget categories** (balanced = emerald) → **Accept** (committed; supersedes prior). The centerpiece sub-flow.
- **Cost entry** — the **"Did you pay this already?"** gate (receipt vs vendor bill) → `cost-line-form`; GST auto + override; Mark-paid.
- **PO lifecycle** — draft→sent→acknowledged→received→closed ("Mark {next}"). **By type / By category** subtabs (`costs-subtabs`).

**Labour tab**
- **Approve-hours** — time-entry visibility/adjust (worker self-edit ≤24h, then owner).
- **Worker-invoice queue** — a sub builds an invoice from unbilled time + expenses → owner **approve / reject / mark-paid** (cross-project queue at `/invoices?view=worker`). By-worker filter.

**Billing tab (project)**
- **New draw** (`createMilestoneInvoiceAction`, live GST) · **Invoice full estimate** (gated on approved) · **Generate final**. **Record-payment** (`record-payment-dialog`, §19, Interac parity). Rows → shared `/invoices/[id]` (graduate, `invoices.md`). The peach **"Ready to bill draw N"** Henry prompt.

**Cross-refs (own briefs/inventories):** Budget→`estimate.md` · Schedule→`schedule.md` · Client→`client.md` · Overview→`overview.md` · `/invoices/[id]` detail + customer pay → `invoices.md` / `customer-documents.md`.

## Accessibility
WCAG 2.2 AA: near-black ink on white; never colour-only for status/margin/over-budget (label + glyph); the `▾` Details trigger + `⋯` overflow are labeled, focus-ringed, keyboard-operable; the Crew checklist + override disclosures are keyboard-reachable; tab nav + `<select>` operable; attention-strip items are real links/buttons; ≥44px targets on mobile capture + quick actions.

## Open questions
- **Notes → Overview activity** — confirm folding the internal Notes feed (incl. `henry_q`/`henry_a`) into the Overview timeline vs keeping a light internal tab.
- **Client hub click-cost** — default-to-Messages + badge-on-tab is the mitigation; validate it doesn't slow the most-common action too much.
- **Global dispatch board** — **landed** at `/calendar` (`calendar.md`); the project Schedule shows a **read-only crew-this-week card** deep-linking there (no write-back, per calendar.md decision #4).
- **Assign action reads worker default** — build-check that blank overrides inherit `worker_profiles` defaults end-to-end (not stored null without a COALESCE downstream).
- **% complete fully off the header** — confirm (it's on Overview); or a thin hairline progress line under the title if missed.
- **Reviving `getProjectInsights`** — confirm the rule set + that the strip lives on Overview only.
- **Pulse → project** — reuse `draftPulseAction`/`approvePulseAction` into the Client hub; sequencing vs the rest of V1.
