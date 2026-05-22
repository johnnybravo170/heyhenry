# OD Brief — Project Hub (the execution workspace)

> **Grounded in:** `src/app/(dashboard)/projects/[id]/page.tsx` (the shell — header, tab IA, lifecycle-default-tab, per-tab streaming), `tabs/overview-tab-server.tsx` (VarianceSection + ProjectFactsSection + TimelineSection), `tabs/costs-tab-server.tsx` + `costs-tab.tsx` + `costs-subtabs.tsx` (Spend), `tabs/invoices-tab-server.tsx` + `invoices-tab.tsx` (Billing), `tabs/time-tab-server.tsx` (Labour), `tabs/{schedule,messages,gallery,portal,selections,documents,memos,crew}-tab-server.tsx`, `budget-summary.tsx` (`VarianceTab`), `unsent-changes-chip.tsx`, `scope-diff-review.tsx`, `applied-co-banner.tsx`, `project-timeline.tsx`, `project-intake-zone.tsx`, `project-name-editor.tsx`, `percent-complete-editor.tsx`, `management-fee-editor.tsx`, `billing-mode-editor.tsx`, `henry-insight-strip.tsx` + `getProjectInsights` (**dead — see Henry**); `server/actions/project-assignments.ts` (`assignWorkerAction` — owner/admin only; nullable per-job rate overrides); queries `getVarianceReport`, `getBudgetVsActual`, `getProjectDrawSummary`, `getProjectProgress`, `getUnsentDiff`/`getLatestSnapshot`, `getProjectChangeOrderContributions`; migrations `0051_worker_profiles.sql` (`default_hourly_rate_cents`), `0054_pay_and_charge_rates.sql` (`default_charge_rate_cents` on workers; `charge_rate_cents` on assignments), `0052_project_assignments.sql` (`scheduled_date` nullable), `0097` (lifecycle_stage). Vault: Project Hub Spec `6c0de27d`, Object Model `b4d880be`, Role Matrix `03b1ccf4`, IA/Nav `6529e9ae`; `docs/ux/sacred-path-map.md`. Siblings: **`briefs/estimate.md`** (the SAME Budget table, authoring face), **`briefs/invoices.md`** (the cross-project Billing/AR list), **`briefs/customer-documents.md`** (the homeowner-facing docs the Client hub manages), **`briefs/projects-list.md`** (entry point).
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

## The Project Details card *(target — new; the `▾` target)*
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

## Overview = the cockpit *(target — "what needs you," not a wall of numbers)*
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

**Table structure — one aligned grid (refined this round):**
- **The 4-column grid (Estimate · Spent · Committed · Remaining) holds top-to-bottom** — section → category → line, one *shared* column grid (NOT a nested sub-table with its own widths), so every value sits dead under its header and you can scan straight down any column. **Sticky column headers** stay visible while scrolling into line detail. *(Principle: category rows and line rows share the grid — the financial breakdown is consistent at every level; don't give lines a separate layout.)*
- **Collapsed section rows** lead with the section **Estimate**, then **"% used"** (= spent + committed ÷ estimate) + an over-flag when >100% — never spent-$ beside a consumed-%.
- **Per line:** Estimate (line price) · Spent · Committed · **Remaining (= Estimate − Spent − Committed)**, right-aligned to the same edges, summing up to the category row. A not-started line shows its full price as Remaining (not $0). Line state is conveyed by *which column* holds the value, so desktop drops the SPENT/COMMITTED/PROJECTED text tag (mobile keeps it — no columns there).
- **Alert de-dupe:** the Margin-at-risk chip stays high-level; the in-table section flag (e.g. "FRAMING OVER $4,800") carries the specific — don't name the same item in both.
- **Mobile:** table → stacked category cards; the section single-number row uses "Estimate · % used · flag"; alert chips are single-line.

## Scope-diff / unsent-changes — the contract-protection spine
On approval (+ each CO apply) the scope is snapshotted; later edits are diffed (`getUnsentDiff`, classified `send_as_co | internal`). **`UnsentChangesChip`** (below the header): *"N unsent changes since v{N} · ±$X · M look customer-impacting"* → opens **`ScopeDiffReviewClient`** (`?review=diff`): per-row **Revert to last signed**; footer **Create Change Order** (`createChangeOrderFromUnsentDiffAction` → the CO editor — see `change-order.md`). Fix the stale modal copy ("send the rest as a CO from the Changes tab" — the button creates it inline). Add a **"notify customer (non-billable)"** path for internal-but-visible changes (routes to the portal update, distinct from a billable CO).

## Spend — fix + restyle
The project's **external money-out** ledger (POs, vendor bills, sub-quotes, expenses), grouped by category; "By type"/"By category"; deep-linked from Budget. Fixes: **the "Paid" summary cell shows total *expenses*, not paid bills** (`costs-tab.tsx:282/372`) — relabel/recompute; **one Committed number** that reconciles with `VarianceTab` (sub-quotes + POs as its breakdown, not two silos); **stable landing subtab**. Paper + `Money` + token chips (Uncategorized = `warning`-soft, not ad-hoc amber); Henry "missing receipt?" / "categorize this bill" nudges (capture-now/clean-up-later).

## Labour (was "Time")
Labour hours (`time_entries`) + worker invoices, by worker, at the assignment's pay/charge rate — rolling into budget actuals (`getBudgetVsActual` labour). Restyle to Paper + `Money`; show approve-hours flow; this is the **internal** money-out tab paired with **Spend**. (Rename is label-only; route key stays `time`.)

## Billing (was "Customer Billing")
Project-scoped billing — **Draws** (`doc_type=draw`: Label · Status · % Complete · Total · % of Contract + "Drawn to date $X of $Y") + **Invoices** (final + legacy). Actions: **+ New draw** (`createMilestoneInvoiceAction`, live GST preview), **Invoice full estimate** (gated on approved), **Generate final**; per-row **Mark paid** (`RecordPaymentDialog`) + **View** (→ shared `/invoices/[id]`). Dovetail `invoices.md`: same `RecordPaymentDialog`, same draw vocabulary, the **peach "Ready to bill draw N — $X?"** Henry prompt, legible "Draw 3 of 5."

## Photos · Documents · Schedule (secondary/work tabs)
- **Photos** — before/after/progress/concern library; upload + auto-tag (`acceptAiTagAction`); portal-visible flag drives what Client shares.
- **Documents** — internal file store + **Home Record** generate/email + trade contacts; client-facing docs surface in Client.
- **Schedule** — the job's timeline (milestones/phases/tasks); **v0 read-only** (no CPM in V1 per Scope Lock). Will host the **crew-day slice** when the dispatch board lands (below). The "Electrical dates locked" cue belongs here.

## Crew scheduling — a cross-project surface (deferred)
Crew **scheduling** (who's on which site which day = `project_assignments` with a set `scheduled_date`) is inherently **cross-project** — a worker is one body across all jobs. So it wants a **global dispatch board in the left nav** (account-level), the same `project_assignments` data, which **feeds** the project. The project keeps a **filtered slice** ("this job's crew days," on Schedule), read-mostly with light write-back — *one model, two scopes; not a separate engine, not just a link.*
- **V1:** ship the **roster** (the Details-card checklist, `scheduled_date` null) now; **defer** the dated grid + the global dispatch board (Scope Lock defers scheduling; Schedule is v0 read-only). **The global dispatch board earns its own brief.**

## Henry intelligence (built · dead · gap)
- **Built/live:** `VarianceTab` margin numbers; the **scope-diff** with `henry_suggests`; intake classify-and-file (`ProjectIntakeZone`); photo auto-tag.
- **DEAD — revive it:** `getProjectInsights` + `henry-insight-strip.tsx` → the **Overview attention strip** (the cheapest big win).
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

## Accessibility
WCAG 2.2 AA: near-black ink on white; never colour-only for status/margin/over-budget (label + glyph); the `▾` Details trigger + `⋯` overflow are labeled, focus-ringed, keyboard-operable; the Crew checklist + override disclosures are keyboard-reachable; tab nav + `<select>` operable; attention-strip items are real links/buttons; ≥44px targets on mobile capture + quick actions.

## Open questions
- **Notes → Overview activity** — confirm folding the internal Notes feed (incl. `henry_q`/`henry_a`) into the Overview timeline vs keeping a light internal tab.
- **Client hub click-cost** — default-to-Messages + badge-on-tab is the mitigation; validate it doesn't slow the most-common action too much.
- **Global dispatch board** — its own brief; confirm the project Schedule "crew-day slice" is the right per-project view when it lands.
- **Assign action reads worker default** — build-check that blank overrides inherit `worker_profiles` defaults end-to-end (not stored null without a COALESCE downstream).
- **% complete fully off the header** — confirm (it's on Overview); or a thin hairline progress line under the title if missed.
- **Reviving `getProjectInsights`** — confirm the rule set + that the strip lives on Overview only.
- **Pulse → project** — reuse `draftPulseAction`/`approvePulseAction` into the Client hub; sequencing vs the rest of V1.
