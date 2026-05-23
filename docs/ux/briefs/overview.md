# OD Brief — Project ▸ Overview (the run-the-job cockpit)

> **Grounded in (read these before prompting):**
> - **Route / shell:** `src/app/(dashboard)/projects/[id]/page.tsx` (tab key `overview`, label "Overview"; **default tab for `active`+ projects**, planning/awaiting_approval default to Budget) → `tabs/overview-tab-server.tsx` — streams three Suspense sections: `HenryInsightStrip` → `VarianceSection` (`budget-summary.tsx` `VarianceTab`) → `TimelineSection` (`project-timeline.tsx` over `listProjectEvents`). The editable project facts **moved to the Project Details card** (the header `▾`), freeing Overview to be a cockpit.
> - **The "Needs You" engine:** `src/components/features/projects/henry-insight-strip.tsx` + `src/lib/db/queries/project-insights.ts` (`getProjectInsights`). **Data sources it could draw on:** `getUnsentDiff` (scope changes), `getBudgetVsActual` (per-category over/under), `getVarianceReport` (`margin_at_risk`, committed), `getProjectDrawSummary` (ready-to-bill / drawn-to-date), overdue logic in `lib/db/queries/dashboard.ts`, unread messages+ideas counts (already computed in `page.tsx` for the `Client` tab badge), `project_costs` (missing receipts / unpaid bills), and **schedule slip** (the behind calc from `schedule.md`).
> - **Existing render (the design target — committed):** `od-project-hub/screens/desktop.html` / `mobile.html`. The Overview cockpit is the headline screen; its "Needs you" strip already designs the full ranked aggregator (5 rows + "+N more").
> - **Vault (current-state, evergreen):** `Module: Project Hub redesign — Overview cockpit + Project Details card` `346596b3`. Foundation: Positioning `5bfa59be`, Object Model `b4d880be`, Workflow Library `e0263cc3`, Role × Object Matrix `03b1ccf4`, IA/Nav `6529e9ae`. Design system: `DESIGN.md`, `DESIGN-NOTES.md`, `PATTERNS.md` (§5 action result, §7 status badges/`status-tokens`), `src/lib/ui/status-tokens.ts`.
> - **Siblings (each owns one alert type the strip aggregates):** `project-hub.md` (the shell + the canonical **§"Alert surfacing model"** — this brief is its Overview half), `estimate.md`/Budget (margin, over/under), `invoices.md` + project-hub §Billing (ready-to-bill / overdue draw), `change-order.md` (unsent scope changes), `schedule.md` (slip), Spend (missing receipts / unpaid bills), Client hub (unread messages/ideas).
>
> **How to use:** the design is already rendered (`desktop.html`/`mobile.html`) — this brief **codifies that target so the code catches up**, then run `heyhenry-design-critique` on the built result. (Re-render only if the engine spec below changes the visual.)
>
> **⚠ The defining gap — design is AHEAD of code.** The render fully designs the aggregator; the **live engine is a stub.** `getProjectInsights` computes only **3 rule types** (unsent changes, section over-budget, section under-budget) + an on-track fallback, **caps at 2** (`.slice(0,2)`), **omits margin-at-risk entirely** (the single most important cockpit signal), and `HenryInsightStrip` styles with **raw `amber/emerald/blue` Tailwind + a generic `Sparkles` icon** — not `status-tokens` soft pairs, not the rust ✦. Both files' header comments still say *"on the Budget page (Executing mode)"* — stale (it's on Overview now). This brief specs the **target aggregator** + the **Paper restyle**. (Inverse of `schedule.md`, where code was ahead of the doc.)

**Object / workflow / role(s):** primary = the **Project in execution** (its margin, scope-diff, billing position, field activity); workflow = the **Field Operations Loop** (Workflow Library #4) — *the operator's daily "what needs me on this job today" read*. Roles: **owner / admin / member** (full); **worker** (never — `/w`); **homeowner** (never — portal). **Primary action:** *see if the job is on-track and on-margin, and do the one next thing that keeps it moving.*

## Purpose
The operator's **run-the-job** home — the tab `active`+ projects land on. Per the Project Hub Spec it answers four questions at a glance: **"Am I making money? What's changed since they signed? What can I bill? What needs me today?"** It is a **cockpit that prompts action, not a dashboard of standing numbers** (reject-if: "Dashboard reports instead of prompting action"). Three stacked layers: the **"Needs You" attention strip** (do-this, ranked) → the **Budget & margin** summary → the **Activity** feed.

## Current vs target (the delta this brief drives)
1. **The "Needs You" engine is a stub → make it the project-wide aggregator.** Today: 3 rule types, cap 2, no margin-at-risk. Target (per the render + `project-hub.md` §Alert model): **~7 alert types, severity-ranked by Henry, capped ~4 + "+N more,"** one row per type, each linking to its owning tab. **THE headline change.**
2. **Margin-at-risk is missing and must lead.** The render's #1 row is *"Margin at risk · 6% vs 18% target · framing labour over by $4,800."* `getVarianceReport.margin_at_risk` already exists; the engine just doesn't read it. Add it as the top-priority danger rule.
3. **Off-brand styling → Paper.** Replace raw `amber/emerald/blue` with `status-tokens` soft pairs; replace the generic `Sparkles` with the **rust ✦** Henry mark; **fill reflects meaning** (peach = ready-to-bill/positive-action, warn-soft = caution, danger-soft = at-risk — never danger-red on a positive). 3 type sizes; Money tabular + de-emph cents.
4. **Wire the three-layer alert model.** The strip total must equal the Σ of per-tab label badges must equal the mobile select trigger count (`project-hub.md` §Alert model). Today the badges and the strip are independent.

## The data truth this screen must reflect
- **Lifecycle drives whether Overview is home** (`0097`): `planning | awaiting_approval` default to **Budget** (authoring); `active | on_hold | complete` land on **Overview** (status-tracking). Explicit `?tab=` wins.
- **Margin-at-risk** (`getVarianceReport`): `margin_at_risk = estimated_revenue − actual − committed` (revenue = scope subtotal + management fee). Negative = danger. Render expresses it as **current margin % vs target %** + the specific driver ("framing labour over by $X").
- **Budget-vs-actual** (`getBudgetVsActual`/`getVarianceReport`): Estimate (Σ priced lines) − **Spent** (labour + bills + expenses, pre-tax) − **Committed** (accepted sub-quotes + open POs) = **Remaining**. Plus `% complete` and `% of budget consumed`.
- **Unsent changes** (`getUnsentDiff`): count since baseline `v{N}` + how many look customer-impacting (`suggested_co_count`).
- **Ready-to-bill / overdue** (`getProjectDrawSummary` + overdue logic): the next draw available to bill; a `sent` draw older than 14 days = overdue.
- **Schedule slip** (`schedule.md`): a task whose working-day end < today and status ≠ done.
- **Field truth = `project_events`** drives the Activity feed (no "daily log").
- **`getProjectInsights` is rule-based, no LLM in the critical path** (decision `6790ef2b` — "Henry surfaces things to consider, never commands"). Keep it deterministic.

## Layout (regions → real primitives)
Desktop, top to bottom. Keep the streaming architecture (each section paints independently).

**1 · "Needs You" strip — the aggregator (the cockpit's reason to exist).**
- **Eyebrow:** mono-uppercase `NEEDS YOU` + `{N} today · ranked by Henry`.
- **Ranked rows (~4 shown), each = icon + Henry label + plain-English body + one CTA → owning tab.** From the render, in severity order:
  - `danger` **Margin at risk** — "6% vs 18% target · framing labour over by $4,800" → **Open Budget**
  - `bill` (peach) **Ready to bill** — "Draw 3 · rough-in complete · $18,400" → **Bill draw** (→ Billing)
  - `warn` **Unsent scope changes** — "2 changes since v2 · +$3,200 · customer-impacting" → **Review** (→ scope-diff)
  - `info` **Client message** — "Daniel · '…brushed nickel pulls?' · 2h ago" → **Open Client**
- **"+N more" tail** — collapses the rest ("+1 more · 3 missing receipts · Mike Reyes, May 18–20") with **Show all ▾**.
- **Calm empty state** — when nothing's actionable, one quiet neutral line: **"On track — nothing needs you."** (The engine's `on_track` fallback; restyle off `amber/blue`.)
- Primitive: a list of `status-tokens`-toned rows; rust ✦ marks the Henry-authored nature; each CTA is a real `<Link>` (≥44px on mobile).

**2 · Budget & margin summary card** (`VarianceTab`, condensed) — Estimate · Spent · Committed · Remaining (Money, tabular, de-emph cents) + a progress line ("53% complete · 61% of budget consumed · $86,100 of $142,000") + **Open Budget →**. This is a *summary that links to detail*, not the full Budget table. Move raw `red/amber/green` onto `status-tokens`. (Margin detail also surfaces here; the strip's margin row is the *interrupt*, this card is the *read*.)

**3 · Activity feed** (`ProjectTimeline` over `project_events`) — chronological job history. Target (per `project-hub.md` Open Q): absorb the internal **Notes** feed here so Overview is the single activity surface.

## The "Needs You" aggregator — engine spec (the build heart)
Extend `getProjectInsights` from 3 rules → the ranked set below; raise the cap to **~4 shown + "+N more."** Each insight keeps the existing `{ kind, message, href, priority, tone }` shape; add `cta` label + a severity tier. Severity-rank, then recency.

| Rule (kind) | Source | Tone | Priority band | CTA → |
|---|---|---|---|---|
| `margin_at_risk` *(new, leads)* | `getVarianceReport.margin_at_risk` < 0 or margin% < target | danger | 95 | Budget |
| `unsent_changes` *(exists)* | `getUnsentDiff` | warn | 90 | scope-diff |
| `overdue_draw` *(new)* | draw `sent` > 14d | danger | 88 | Billing |
| `ready_to_bill` *(new)* | `getProjectDrawSummary` next draw | bill/peach | 75 | Billing |
| `schedule_slip` *(new)* | `schedule.md` behind calc | warn | 72 | Schedule |
| `section_over_budget` *(exists)* | `getBudgetVsActual` >10% & >$250 | warn | 70+ | Spend (focus) |
| `client_message` *(new)* | unread messages/ideas | info | 60 | Client |
| `missing_receipts` *(new)* | unpaid bills / receipt-less costs | info | 50 | Spend |
| `section_under_budget` *(exists)* | 85–95% spent | success | 40 | — |
| `on_track` *(exists, fallback)* | none of the above | neutral | 10 | — |
- **Dedupe with in-tab chips:** the strip names the *item*; the owning tab's inline chip carries the *detail* — don't say the same thing twice (e.g. the strip's "framing over $4,800" vs Budget's in-table FRAMING OVER flag).
- **Critical escalation (one signal):** a can't-miss item (margin blown, badly overdue) may tint the **header status badge** with a single quiet severity cue — resolved here. Never a banner, never a stack.

## Alert-surfacing model (this brief = the Overview half of `project-hub.md` §Alert model)
Three layers, never stacked banners:
1. **Overview "Needs You" strip = the aggregator** — *all* of the project's alerts, ranked, ~4 + "+N more."
2. **Tab-label badges = per-tab counts** — each alert owned by the tab where it's resolved (`Budget² · Billing¹ · Spend¹ · Client²`); visible from any tab. **Mobile:** the count moves to the nav `<select>` (trigger total + per-option badges).
3. **Inline chips on the owning tab = where you act.**
**Consistency contract:** strip "N today" = mobile trigger total = Σ per-tab badges. Build the three off the **same** insight set so they can't drift.

## Progressive disclosure
- **Snapshot:** the "Needs You" strip (do-this) — the one thing the operator reads.
- **Operational:** the Budget & margin summary (the money read).
- **Detail:** each CTA deep-links to the owning tab; the variance card → Budget.
- **Audit:** the Activity feed (`project_events`) + the (folded-in) Notes.

## Henry intelligence touchpoints
**The strip IS the Henry surface** — ranked, plain-English "things to consider," not commands ([[henry-intelligence-not-chat]], decision `6790ef2b`). Henry = the **ranking + synthesis** intelligence (deterministic v1; an LLM pass could refine ordering/phrasing later, never in the critical path). Labeled with the rust ✦. **Never auto-acts** — every row is a link to a human-driven surface; nothing sends or bills itself. The calm "On track — nothing needs you" is itself a Henry judgment (it checked and there's nothing). No chat box.

## Connections (every tab feeds Overview; Overview routes back)
Margin → Budget · ready-to-bill/overdue → Billing · unsent changes → scope-diff · schedule slip → Schedule (the slip calc from `schedule.md`) · client message/idea → Client hub · over-budget category → Spend (focused) · missing receipts → Spend. Overview owns **no data of its own** — it's the ranked read of every other tab + the activity feed. (That's the point: one place to know what needs you, then go act where it's resolved.)

## Role variations
- **Owner / admin / member:** full cockpit incl. margin/cost/billing reads. (Members see it; sensitive *actions* gate downstream.)
- **Worker:** never — `/w` only; no margin/cost/billing ever.
- **Homeowner:** never — the **portal** is their surface; Overview is internal. No markup/margin/cost leaves the dashboard.

## Mobile vs desktop
*"Mobile = doing work; desktop = thinking work."* Overview is **critical on both** — the one surface equally important on a phone and at the desk.
- **Desktop:** full strip + Budget&margin card + Activity; per-tab badges inline on the nav.
- **Mobile:** the **"Needs You" strip is the whole first screen** — ranked rows as ≥44px tap targets with their CTAs (mark a draw paid, review a diff, open a message); the Budget&margin card collapses to a 2-up summary; the badge layer rides the nav `<select>` (trigger total + per-option counts). This is the GC's morning "what's on fire" glance.

## Financial / Canadian
**CAD**, tabular-nums, de-emph cents via `Money`. The margin row + Budget&margin card carry the money truth (margin %, draw $, budget consumed). **GST/HST** appears where draws do (the Billing CTA target, not here). Management fee = the cost-plus markup feeding margin. **No holdback.**

## States
- **Just approved (entering execution):** calm strip ("On track"), Budget&margin baseline = "Original estimate · v1," empty-ish activity.
- **In flight:** strip populated + ranked; badges lit across tabs.
- **At risk:** `margin_at_risk` leads the strip in danger-soft; the header status badge may carry the one quiet escalation cue.
- **Complete / closeout:** strip points to final invoice / Home Record; activity shows closeout events.
- **On hold / cancelled:** muted; strip suppresses action prompts; clear status.
- **Loading:** the existing per-section skeletons (strip / variance / timeline stream independently — keep).
- **Empty (clean):** "On track — nothing needs you."

## Subscreen inventory
Overview is an **aggregator that links out** — it spawns almost no modals of its own; its "subscreens" are disclosures + deep-links. (The header's Project Details card `▾` and `⋯` actions menu sit above Overview but belong to the **shell** — inventoried in `project-hub.md`, not here.)

**Expansion / disclosure**
- **"Needs You" — "+N more / Show all"** — the strip caps at ~4 rows; the tail collapses ("+1 more · 3 missing receipts") and expands to the full ranked list on Show all.
- **Activity feed** — chronological `project_events` (+ folded-in Notes); "load more" / per-event detail inline.

**Inline / transient**
- **Each Needs-You row** — icon + Henry label + plain-English body + one CTA; tone via `status-tokens` (fill = meaning). Calm empty: "On track — nothing needs you."
- **Critical-escalation cue** — a single quiet severity tint on the **header status badge** for a can't-miss item (resolved here); never a banner.

**Link-outs (not modals — but the operator leaves Overview via these)**
- Each alert CTA → its **owning tab** (margin→Budget · ready-to-bill/overdue→Billing · unsent→scope-diff · slip→Schedule · message→Client · receipts→Spend); Budget & margin card → Budget.

**Nothing graduates.** Overview spawns no standalone subscreen — by design it's the ranked read + the doorway to where work is resolved.

## Accessibility
WCAG 2.2 AA. Severity **never colour-only** — each row carries an icon + label (Margin at risk / Ready to bill / Overdue) so tone is redundant. Ranked rows + CTAs are real links, keyboard-operable, focus-ringed, ≥44px on mobile. "+N more / Show all" is a real disclosure button. Money is tabular; the variance card's progress bar has a text equivalent. Strip items announce their count ("Needs you, 5 items").

## Reject-if self-check (per `heyhenry-design-critique`)
- ✅ Prompts action, not a standing-number dashboard (the whole thesis). ✅ Grounded in real engine/queries (flags the stub honestly). ✅ Henry = the ranking intelligence, not a chat. ✅ Project is gravity (Overview = the ranked read of the Project). ✅ No per-seat. ✅ Homeowner/worker boundaries respected. ✅ No stacked banners (the three-layer model). ✅ Canadian money where it belongs. ⚠ Watch: keep it a **summary that links out** — don't let the Budget&margin card balloon into the full Budget table (that's Budget's job); don't duplicate an item in both the strip and an in-tab chip.

## Open questions
- **Engine scope for v1.** Which of the new rules (margin-at-risk, overdue, ready-to-bill, schedule-slip, client-message, missing-receipts) land first? Recommend **margin-at-risk + ready-to-bill + overdue** first (the money trio), then slip/message/receipts.
- **Schedule-slip dependency.** The `schedule_slip` rule needs the working-day "behind" calc from `schedule.md` — sequence after that card.
- **Cap + ranking.** Confirm ~4 shown + "+N more"; confirm severity-then-recency ordering and the priority bands above.
- **LLM in the loop?** Keep deterministic for v1 (decision `6790ef2b`); revisit an LLM re-rank/phrasing pass only if the rule-based ordering feels wrong.
- **Notes → Activity.** Confirm folding the internal Notes feed into the Activity timeline (the `project-hub.md` Open Q) lands here.
- **Badge consistency source.** Build the strip + tab badges + mobile-select counts off one shared insight set (so they can't drift) — confirm the query is computed once and shared.
