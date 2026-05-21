# OD Brief — Project Hub (the execution workspace)

> **Grounded in:** `src/app/(dashboard)/projects/[id]/page.tsx` (the shell — header, tab IA, lifecycle-default-tab, per-tab streaming), `tabs/overview-tab-server.tsx` (VarianceSection + ProjectFactsSection + TimelineSection), `tabs/costs-tab-server.tsx` + `costs-tab.tsx` + `costs-subtabs.tsx` (Spend), `tabs/invoices-tab-server.tsx` + `invoices-tab.tsx` (Customer Billing), `tabs/{time,schedule,messages,gallery,portal,selections,documents,memos,crew}-tab-server.tsx`, `budget-summary.tsx` (`VarianceTab`), `unsent-changes-chip.tsx`, `scope-diff-review.tsx` / `scope-diff-review-client.tsx`, `applied-co-banner.tsx`, `project-timeline.tsx`, `project-intake-zone.tsx`, `staged-emails-banner.tsx`, `management-fee-editor.tsx` / `billing-mode-editor.tsx` / `percent-complete-editor.tsx`, `henry-insight-strip.tsx` + `getProjectInsights` (**dead — see Henry**); queries `getVarianceReport`, `getBudgetVsActual`, `getProjectDrawSummary`, `getProjectProgress`, `getUnsentDiff`/`getLatestSnapshot`, `getProjectChangeOrderContributions`; actions `createMilestoneInvoiceAction`, `createInvoiceFromEstimateAction`, `generateFinalInvoiceAction`, `createPurchaseOrderAction`, `upsertBillWithAttachmentAction`, `createChangeOrderFromUnsentDiffAction`, `revertChangeAction`; migration `0097` (lifecycle_stage). Vault: Project Hub Spec `6c0de27d`, Object Model `b4d880be`, Role Matrix `03b1ccf4`, IA/Nav `6529e9ae`; `docs/ux/sacred-path-map.md`. Siblings: **`briefs/estimate.md`** (the SAME Budget table, authoring face), **`briefs/invoices.md`** (the cross-project Billing/AR list), **`briefs/projects-list.md`** (entry point).
> **How to use:** paste into the OD project (HeyHenry "Paper" palette — deepened + the clarity discipline in DESIGN.md), generate hi-fi desktop + mobile, then run `heyhenry-design-critique`.
>
> **Shared-component constraint (read first).** The **Budget tab is one component** serving two postures. `briefs/estimate.md` specs its **authoring** face (pre-approval: build + price scope). This brief specs its **execution** face (post-approval: track actuals) — plus the rest of the Hub. They must reconcile into a **single state-adaptive table**, not two designs. Switch is `estimate_status`/`lifecycle_stage` (`planning`/`awaiting_approval` → authoring + Budget default tab; `active`+ → execution + Overview default tab).
>
> **Current vs target:** the Hub is **built and deep** — a streaming shell (header + 6 primary + 7 secondary tabs), a unified Budget table that wakes its Spent/Committed/Remaining columns in execution, a Spend ledger (POs/bills/expenses/sub-quotes), a project-scoped Customer Billing tab (draws + final), a post-approval **scope-diff** contract-protection mechanism, and an Overview "cockpit." Target deltas: (1) **Overview becomes a real "what needs attention today" cockpit** (revive the dead `getProjectInsights` under Henry chrome); (2) **fix Spend** (the mislabeled "Paid" cell + a single reconciled Committed number); (3) **make scope-diff first-class** (it's the discipline that keeps the contract trustworthy); (4) **wire Henry's Pulse client-update to the project** (today it only exists on the legacy jobs surface); (5) Paper palette + three-type-size discipline + money discipline throughout; (6) tuned mobile ("doing work"). **Flagged** where target differs.

**Object:** the **Project** in execution (`projects` active+, with its budget / costs / invoices / scope-diff / field capture) · **Roles:** owner / admin / member (full); worker (assigned field capture, separate `/w`); homeowner (portal only) · **Primary action:** know if the job is on-track and on-margin, and do the next thing that keeps it moving.

## Purpose
The operator's **run-the-job** cockpit. Per the Project Hub spec: **"NOT a miniature Procore… the smallest reliable surface that keeps the job moving, protects margin, and captures the truth from the field."** A reno GC opens this to answer: *am I making money on this job, what's changed since the customer signed, what can I bill, and what needs me today.* Everything else (Gantt depth, RFIs, submittals) is deliberately out of V1.

## The data truth this screen must reflect
- **Lifecycle drives posture** (`0097`): `planning → awaiting_approval → active → on_hold → complete | cancelled` (+ `declined`). `active`+ = execution; the Hub lands on **Overview** and the Budget table renders **collapsed, actuals-forward**.
- **Budget-vs-actual** (`getBudgetVsActual` / `getVarianceReport`): `estimate` (Σ priced lines) − **`spent`** (labour from `time_entries` + bills + expenses from `project_costs`, **pre-tax** since GST is an ITC) − **`committed`** (accepted sub-quotes + active PO lines) = **`remaining`**. **`margin_at_risk = estimated_revenue − actual − committed`** (revenue = scope subtotal + management fee, incl. per-CO fee overrides). Negative margin-at-risk = danger.
- **The approved estimate is the contract baseline.** Post-approval scope edits are **diffed** against the latest signed snapshot (`getUnsentDiff` vs `getLatestSnapshot`); each change is classified `henry_suggests: send_as_co | internal`. **The hub never silently rewrites the contract** — it surfaces the diff and routes customer-impacting changes to a change order.
- **Billing is draw-based:** `doc_type` `draw | invoice | final`; no partial payments (stages are separate draws); no holdback; overdue derived (`sent` + `sent_at` > 14d). Cost-plus (`is_cost_plus`) vs fixed-price governs the final-invoice math.
- **Field truth = photos + worklog + memos + time** (no "daily log" object). Capture is mobile, offline-tolerant, capture-now/clean-up-later.

## The shell — header + nav *(target — rework: tighter, unified, calmer)*
*Current flaws (operator-confirmed): **not space-efficient** — 7 labeled secondary-tab pills + vertical dividers + a naked trash icon crammed into the header's actions row; **not path-efficient** — navigation is split across two places (secondary tabs in the header, primary tabs in a row below), so the operator looks in two spots to get anywhere; **not info-efficient** — a long line-clamped description competes for space while the one number that matters (margin/health) isn't in the header at all; and it reads cluttered. Rework it.*

Keep the streaming architecture (header paints <100ms; tabs stream in their own Suspense). Restyle to Paper. The header does **two jobs only — orient and navigate — in a tight top zone:**
- **Identity row (one line):** inline-editable name (`ProjectNameEditor`) + **lifecycle status badge** (`status-tokens.ts`) + customer link. Low-frequency actions (**Versions, Delete**, edit/settings) collapse into a single **overflow "⋯" menu** — off the main surface (kills the naked trash icon + the floating Versions dropdown). Description → one truncated line, full text on expand/hover (it rarely earns a glance).
- **Health stat strip (the info-efficient answer):** **one** scannable row of the few numbers that matter — mono-uppercase eyebrows + tabular values: **% Complete · Margin** (health-toned — on-margin / thin / **at-risk** from `getVarianceReport`) **· Draws** (sent · paid · **outstanding**, `getProjectDrawSummary`) **· Target end / days left**. Replaces today's scattered inline %-complete + draws paragraph + the separately-proposed margin chip with one dense strip (DESIGN.md "section header bar with rolled-up metrics + health"). CAD, tabular-nums, de-emph cents.
- **One unified nav (the path-efficient answer):** **fold the 7 secondary tabs into the single tab bar** so navigation lives in *one* place, not split header/below. Primary destinations (Budget · Spend · Time · Schedule · Customer Billing · **Overview**) read prominent; the secondary set (Messages · Gallery · Portal · Selections · Documents · Notes · Crew) reads as a lighter tier or behind a **"More ▾"** overflow — preserving the unread badges (messages, ideas). This also chips at the 13-tab sprawl (open question). Mobile stays the `<select>` (`ProjectTabSelect`).
- **The capture front door stays adjacent:** `ProjectIntakeZone` ("Add to project" — drop the mess, Henry files it: receipts→costs, photos→gallery, sub-quote PDFs→sub-quotes, texts→scope) is the one *action* that belongs by the header. Give it a consistent compact home (a button that opens the drop target), not a wide always-open zone competing with the stat strip. Henry-label it.
- **Contextual banners** (`UnsentChangesChip`, `StagedEmailsBanner`) sit *between* the stat strip and the tab bar — alerts, not chrome; visible only when live.
- **Aesthetic:** Paper, minimal dividers, mono-uppercase metric eyebrows, three type sizes, near-black ink — a calm instrument panel, not a toolbar.

## Overview = the cockpit *(target — the biggest opportunity)*
Today Overview is three stacked blocks: the **variance card** (`VarianceTab` — estimated/committed/actual/margin-at-risk + CO contributions), a **facts grid** (Start · Target End · Mgmt Fee · Billing mode · # Categories — keep, restyle), and an **activity timeline** (`ProjectTimeline`). It reports numbers; it doesn't yet say *what to do.*
- **Target: a "Today / Needs attention" strip at the top** — a prioritized, Henry-chromed **"do this" list (ranked actions, not a wall of numbers)** surfacing only the few things that need the operator: **margin at risk**, **N unsent changes** (customer-impacting), **draw ready to bill** (peach — matches Billing), **overdue draw** (danger), **schedule slip**, **unread customer messages/ideas**, **missing receipts / unpaid bills**. Each item is a one-line statement + a one-tap action — when nothing's wrong it collapses to a calm "On track — nothing needs you." **Revive the dead `getProjectInsights`** (it already computes over/under-budget, unsent-changes, on-track rules — built, wired nowhere) as the engine behind this strip.
- **Henry chrome + fill discipline:** ✦ HENRY label + rust left-border + rust action button; **fill reflects meaning** — *ready-to-bill* = peach `#FEF0E3` (matches the Billing brief), a *caution* (margin/overdue) = warn-soft or danger-soft, a neutral heads-up = white. **Never danger-red on a positive.**
- Keep variance + facts + timeline below the attention strip — the cockpit is "what to do" first, "the numbers" second, "what happened" third.

## Budget — execution posture
The same table from `estimate.md`, now actuals-forward. **Spent · Committed · Remaining** columns + multi-segment **progress bars** are live; **CO chips** mark categories touched by applied change orders; the **"spent by source"** strip (Labour/Bills/Expenses → deep-links to Time/Spend) appears; per-line **actuals** expand (`CostLineActualsInline`). The `AppliedChangeOrdersBanner` ("Estimate signed · N applied COs" + version history) anchors the top. Money/colour discipline: move raw `red-600`/`amber-600`/`green-500` onto `status-tokens.ts` soft pairs (over = danger, projected-over = warn) + token progress colours; collapse the ~6 font sizes to three. **Sections default collapsed** in execution (status-tracking posture); the operator expands what they're watching.

## Scope-diff / unsent-changes — the contract-protection spine *(target — make it first-class)*
This is the discipline that makes the whole sacred path trustworthy. On approval (and on each CO apply) the scope is **snapshotted**. Any later edit to `project_cost_lines`/`project_budget_categories` is diffed by `getUnsentDiff` and classified `send_as_co` (label/total change → customer-impacting) vs `internal` (reorg).
- **`UnsentChangesChip`** (shell): *"N unsent changes since v{N} · ±$X · M look customer-impacting"* → opens the review.
- **`ScopeDiffReviewClient`** modal (`?review=diff`): per-row **Revert to last signed**; footer **Create Change Order** (`createChangeOrderFromUnsentDiffAction` → the CO editor — its own brief, S5). **Fix the stale copy** ("send the rest as a change order from the Changes tab" — the button now creates it inline).
- **Target gap:** there's **no "send the customer a non-billable update" path** here — only CO or portal. For *internal* reorgs that the customer should still *see* (e.g. a substitution at no cost), offer a "note the customer" path that routes to the portal update (below), distinct from a billable CO.

## Spend (costs) — fix + restyle
The project ledger: **POs** (inline `POForm`, status draft→sent→acknowledged→received→closed), **vendor bills** + **expenses** (merged into one "Costs" surface), **sub-quotes**. "By type" / "By category" views; deep-linked from Budget (`?focus=<category>`). Keep the structure; fix:
- **BUG — the "Paid" summary cell shows total *expenses*, not paid bills** (`costs-tab.tsx:282/372`). Relabel/recompute to a true Paid figure (or drop it).
- **One Committed number.** Today "Committed" (accepted sub-quotes) and "PO'd" (open POs) are parallel silos that don't reconcile with `VarianceTab`'s `committed_cents` (= sub-quotes + POs). **Target:** a single Committed that matches the Budget/variance definition, with sub-quotes/POs as its breakdown.
- **Stable landing subtab** (today it shifts by data presence — disorienting).
- Paper + money discipline; receipts/attachments as thumbnails; Henry "missing receipt?" / "categorize this bill" nudges (capture-now/clean-up-later).

## Customer Billing — dovetail the AR brief
Project-scoped billing. **Draws table** (`doc_type=draw`: Label · Status · % Complete · Total · % of Contract, with a *"Drawn to date $X of $Y · Z%"* header from `getProjectDrawSummary`) + **Invoices table** (final + legacy). Actions: **+ New draw** (`DrawForm` → `createMilestoneInvoiceAction`, live GST preview), **Invoice full estimate** (gated on approved, `createInvoiceFromEstimateAction`), **Generate final** (`generateFinalInvoiceAction`), per-project **GST-on-draws** override; per-row **Mark paid** (`RecordPaymentDialog`) + **View** (→ shared `/invoices/[id]`).
- **Dovetail `briefs/invoices.md`:** same `RecordPaymentDialog`, same draw vocabulary, same money discipline, same **peach "Ready to bill draw N — $X?"** Henry prompt. This tab is the per-project face; the AR screen is the cross-project roll-up — they must feel like one system. **Make the draw schedule legible** ("Draw 3 of 5") — the cure for the orphan-draft problem the AR brief names.

## Secondary tabs (keep; light treatment, Paper restyle)
- **Time** — labour `time_entries` + worker invoices.
- **Schedule** — Gantt tasks, **v0 read-only** (no CPM in V1 — per Scope Lock); bootstrap panel when empty; customer-notify with Undo.
- **Messages** — `project_messages` thread; prompts to enable the portal if off.
- **Gallery** — before/after/progress photos (first-class per Scope Lock); upload + auto-tag (`acceptAiTagAction`).
- **Portal** — enable/visibility, phases, decisions, and **`PortalUpdateForm`** (the manual client-update composer — see Henry gap).
- **Selections** — per-room selections + the customer **idea-board** (unread badge in the shell).
- **Documents** — file store + **Home Record** generate/email + trade contacts.
- **Notes** — unified notes/memos/events feed including Henry items (`henry_q`/`henry_a`/`reply_draft`).
- **Crew** — 14-day assignment grid + roster.

## Henry intelligence (built · dead · gap)
- **Built/live:** `VarianceTab` margin numbers (Overview + Budget header); the **scope-diff** with `henry_suggests`; Notes-tab Henry Q&A / reply-draft; `ProjectIntakeZone` classify-and-file; photo auto-tag.
- **DEAD — revive it:** `getProjectInsights` + `henry-insight-strip.tsx` (rule-based over/under-budget · unsent-changes · on-track) are built but **wired nowhere** (docstring still says "Budget page (Executing mode)"). This is the engine for the **Overview attention strip** above — the cheapest big win in the Hub.
- **GAP — wire Pulse to the project:** Henry's **auto-drafted client update** (`UpdateClientButton` → `draftPulseAction`/`approvePulseAction` — Henry drafts a progress update from project activity, operator reviews + sends SMS/email) lives **only on the legacy `jobs` surface**. The project hub has only the **manual** `PortalUpdateForm`. **Target:** bring Pulse to the Portal/Overview surface — Henry drafts, operator approves + sends (never auto-send). This is the headline Henry-leverage gap on the execution side.
- Discipline: Henry is the guide, the GC is the hero; embedded intelligence, not a chat box; nothing customer-facing auto-sends.

## Role variations
- **Owner / admin / member:** full Hub incl. cost/margin/spend (RLS tenant-scoped, role-agnostic for project data).
- **Worker:** field capture only, on assigned projects, via `/w` — photos, time, assigned tasks, expenses (if `can_log_expenses`); **never** sees margin, costs, billing, or other projects. (The worker app is its own surface — not this screen, but the Hub's captured truth comes from it.)
- **Homeowner:** the public **portal** only (phases, decisions, shared photos, messages, pay) — never the Hub; never cost/markup/margin/other customers. The portal boundary is load-bearing.

## Mobile vs desktop
**"Mobile is for doing work; desktop is for thinking work"** (Project Hub spec). Project Overview is the one surface equally critical on both.
- **Desktop:** the full cockpit + dense Budget/Spend tables + multi-line authoring/reconciliation.
- **Mobile:** glance the **cockpit attention strip + margin/draws health**, **capture** (the `ProjectIntakeZone` drop-zone, photos, voice memo), check **Schedule**, log **Time**, fire **quick actions** (mark a draw paid, approve a Pulse draft, answer a message). Dense tables → **stacked cards** (Budget category cards: name · estimate · spent · remaining + a thin bar; Spend cards by type). Tab nav = `<select>`. 44px+ targets. The diff-review + send dialogs → bottom sheets.

## Financial / Canadian
- **CAD**, tabular-nums, de-emph cents everywhere money appears. **GST/HST** province-aware on draws/finals (live preview in `DrawForm`); GST-on-draws mode per project. **Management fee** = the cost-plus markup; **cost-plus vs fixed-price** toggle (`BillingModeEditor`) governs final-invoice math. **No holdback.** WCB/place-name texture where relevant.

## States
- **Just approved (entering execution):** Overview cockpit, empty-ish attention strip ("on track — nothing needs you"), budget collapsed/actuals-forward, scope baseline = "Original estimate."
- **In flight:** attention strip populated; unsent-changes chip when scope diverges; draws being billed.
- **At risk:** margin-at-risk negative → danger health chip + top of attention strip.
- **Complete / closeout:** final invoice generated; the closeout actions (Home Record, gallery, final paid).
- **On hold / cancelled:** muted; clear status badge; actions appropriately gated.
- **Loading:** the existing per-section skeletons (keep).

## Visual identity
Deepened **Paper** palette; white cards float on warm paper; solid hairlines; near-black ink. **Three type sizes (16/14/12)** + the 4-step ink ramp (the Budget table currently breaks this). **Rust is the single accent** — primary CTA + Henry action buttons; status/over-budget via `status-tokens.ts` soft pairs (never raw red/amber/green/blue). **Henry prompts carry the consistent chrome** (✦ HENRY + rust left-border + rust action; **fill reflects meaning** — peach = ready-to-bill/positive, warn-soft = caution, danger-soft = at-risk, white = neutral; **never danger-red on a positive**). Money right-aligned, tabular, de-emph cents. Mono-uppercase eyebrows for metric labels.

## Accessibility
WCAG 2.2 AA: near-black ink on white; never color-only for status/margin/over-budget (pair with label + icon); inline editors keep the §4 keyboard contract + focus ring; tab nav + `<select>` keyboard-operable; attention-strip items are real links/buttons with focus order; ≥44px targets on mobile capture + quick actions; the cockpit health/margin figures are reachable and announce their state.

## Open questions
- **Tab IA (the 13):** fold/group toward the spec's ~10-section, Overview-led shape, or keep the current 6+7? Needs a deliberate call (don't sprawl further). *(Bigger discussion — decide off the OD output.)*
- **Reviving `getProjectInsights`:** confirm the rule set is what we want surfaced (over/under-budget, unsent-changes, on-track) and where it lives (Overview strip only, or also a thin Budget-tab banner).
- **Pulse → project:** wire the existing jobs-side Pulse to the project Portal/Overview, or build fresh? (Lean: reuse `draftPulseAction`/`approvePulseAction`.) Sequencing vs the rest of V1?
- **Spend "Committed" reconciliation:** confirm the single Committed = sub-quotes + POs definition matches `VarianceTab` and the Budget table everywhere.
- **"Notify customer (non-billable)" path:** is a portal-update route for internal-but-visible scope changes wanted, distinct from a billable CO?
- **Shared Budget component:** this brief + `estimate.md` must be designed so OD produces ONE adaptive table. Generate them together or back-to-back; critique the seam explicitly.
