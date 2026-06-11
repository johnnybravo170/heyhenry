# OD Brief — Budget tab (Scope of Work table + cockpit): structure-is-earned

> **Grounded in:** `tabs/budget-tab-server.tsx`, `budget-cockpit.tsx`, `budget-categories-table.tsx`, `lib/db/queries/project-budget-categories.ts` (incl. `applyScopeToProject`, `getBudgetVsActual`), `server/actions/project-budget-categories.ts`, `lib/estimate/preflight.ts`, `lib/invoices/customer-view-line-items.ts`, `cost-line-form.tsx`, PATTERNS.md, DESIGN.md (Paper palette — live). **How to use:** paste into the OD project, generate hi-fi desktop + mobile, then run `heyhenry-design-critique`.
> **Vocabulary is locked** — Ops vault "Decision: HeyHenry money & scope taxonomy (June 2026)". This brief and the taxonomy rename ship as ONE change (one churn for founding members).
> **Current vs target:** the data model already supports simple projects (sections optional; flat categories with an envelope render to the customer via fallback). The UI contradicts it: section chrome always renders (synthetic "Other" card even when it's the only group), authoring demands the hierarchy upfront ("what do I call the section?"), and preflight falsely flags flat categories at send time. Target: **structure is earned, not required.**

**Primary object:** the project's Scope of Work (sections → categories → line items) + the budget reading on it (estimate / spent / committed / remaining) · **Roles:** owner / admin · **Primary action:** add work; secondary: send the estimate

## Purpose
One screen that scales from "Demolition — $500, done" to a 40-line sectioned remodel **without a mode switch**. A $500 demo job is one flat priced row; a full remodel is sections + itemized categories — same screen, same data, no cliff. The contractor's mental model is "a list of work with prices"; depth appears only when the project's own complexity asks for it.

## The four rules (target — the core of this redesign)
1. **Never render a level that carries no information.** No real sections → no section cards, no section headers, no "Other" wrapper — a flat list of category rows. The synthetic Other group renders ONLY once ≥1 real section exists (then sorts last, as today).
2. **Every row is priceable directly.** A category with no line items shows an editable $ field on the row (the existing envelope — presentation change, not schema). When line items exist, the category amount becomes the computed sum (single-source rule in `getBudgetVsActual` already does this) and the row's $ goes read-only.
3. **Structure grows in place.** Expanding a flat category offers the dashed "+ Add line — break ‹name› into parts" affordance (existing dashed-row pattern). While lines are being added under an envelope, show allocation progress ("$350 of $500 allocated"). "Group into sections" surfaces once there are ~5+ categories (and always via a quiet overflow menu); drag-between-sections exists today.
4. **Warnings police contradictions, not simplicity.** Preflight (`lib/estimate/preflight.ts`) flags envelope-vs-lines mismatch ONLY when lines exist; a zero-line category with a price is a valid flat line item (customer render already falls back to the envelope — `flatCategoriesOf`). Replace the residual nag energy with a "what your customer sees" preview affordance (pairs with `customer_view_mode`).

## Layout
- **Header:** existing cockpit (`BudgetAlertChips` + `BudgetSummaryPanel`: Estimate / Spent / Committed / Remaining) — unchanged this round.
- **Work table heading:** **"Scope of Work"** (was unlabeled/"Budget"). The internal table and the customer estimate share this heading.
- **Authoring entry — ONE affordance:** full-width dashed **"+ Add work"** row → inline name + price in a single step. Placeholder teaches by example: *"e.g. Demolition, Tile, Cabinets."* No upfront Section/Category/Line choice. ("Add section" lives in the overflow / appears per rule 3.)
- **Simple state (no real sections):** flat category rows in one bordered card, column header band per existing hierarchy rules (11px faint at `bg-muted/30`).
- **Structured state (≥1 real section):** current treatment — section heading owns its card (14px bold), categories inside, Other last. Unchanged.
- **Vocabulary on-screen:** levels say Section / Category / **Line item**; cost-line type dropdown says **Cost type**; nouns demoted behind verbs + examples everywhere (buttons say "+ Add work" / "+ Add line", not the noun).

## Progressive disclosure
Snapshot = cockpit · Operational = flat scope rows with prices · Detail = expanded category (line items, cost types, allocation) · Audit = per-line receipts/expenses drill-through to Costs tab (`?focus=` links, existing).

## Henry intelligence touchpoints
- Scope scaffold from text/PDF drop (exists — `applyScopeToProject`); drops in full structure for complex jobs: this is the complex on-ramp, "+ Add work" is the simple one.
- Section description draft (exists, ✦-labeled).
- New: "break this down?" suggestion when a flat category's spend activity implies hidden detail; estimate-preview narration ("Your customer will see Demolition — $500 as one line").
- Henry speech: "I've added framing to the scope" (authoring) / "You're $1,200 over budget on framing" (tracking). Never "scope item", never "budget line".

## Role variations
Owner/Admin: full. Member/crew: read parity with today (no authoring). **Homeowner (estimate doc/portal): ZERO internal taxonomy nouns** — heading "Scope of Work", named rows, prices at the depth `customer_view_mode` dictates. If a level-name leaks onto the customer document, that's a bug.

## Mobile vs desktop
Desktop is the planning surface (this brief's focus). Mobile: read + quick price edit + "+ Add work"; defer drag/section management to desktop. Keep `od-project-hub/screens/mobile-budget.html` in sync on the same rules (especially rule 1 — mobile gains the most from losing empty chrome).

## Financial / Canadian
`<Money>` treatment per DESIGN.md (tabular-nums, de-emph cents). GST/tax/fee lines are never scope (existing `FORBIDDEN_LINE_LABEL` guard). CAD default.

## States
- **Empty:** the hero moment for simple-vs-complex. Three on-ramps, one card: **"+ Add work"** (primary) · drop a PDF/photo (intake → review → apply) · start from template. No taxonomy words in the empty state.
- **Loading:** skeleton per tab-skeleton pattern. **Error:** standard. No offline behavior (desktop planning surface).

## Subscreen inventory
- Inline add-work row (name + $; Enter-to-commit) — inline spec above.
- Category expansion (line items + dashed add-line + allocation readout) — inline.
- "Group into sections" flow (create section, drag/assign) — exists; reposition per rule 3.
- Customer-preview ("what your customer sees") — light modal v1; graduates to the `customer_view_mode` preview when that ships.
- Send flow + preflight strip — existing surfaces; rule 4 changes the rule set only.

## Accessibility
≥44px touch targets on add rows and price fields; visible input borders per form-field convention; focus order: name → price → commit.

## Open questions
1. Once real sections exist, the unsectioned group: keep "Other" (current) or "Ungrouped", and last vs first? (Current: last. Recommend keep-last, label unchanged — smallest change.)
2. Threshold for surfacing "Group into sections" (proposed ~5 categories; always available in overflow).
3. Does "+ Add work" also accept a quick qty/unit, or strictly name + price v1? (Recommend: name + price only; detail lives in line items.)
4. Colour scheme rework is **parked & separate** (Jonathan + John want a full pass) — touches DESIGN.md + design-tokens CI lint + the OD loop Paper clause together. Do NOT improvise palette changes in this redesign round.

## Validation
Say-it-back / phone-call test with Mike + Charlie on the redesigned screen; success = a simple project authored start-to-send with zero taxonomy questions asked out loud. Metric: time-to-first-priced-scope on a fresh project.
