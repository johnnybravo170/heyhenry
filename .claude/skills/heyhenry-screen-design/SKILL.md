---
name: heyhenry-screen-design
description: Generate a build-ready screen spec for a HeyHenry page — layout, composed from the app's existing shadcn/ui primitives and PATTERNS.md, with progressive disclosure, role-aware views, embedded Henry intelligence, mobile/desktop behavior, Canadian financial primitives, and empty/loading/error states — grounded in all five foundation docs and the real design system. Use this when designing, specing, or redesigning a HeyHenry screen, laying out a page, or turning a critique punch list, object map, or workflow into a concrete screen. Triggers on: design the X screen, spec a page, redesign a screen, lay out a view, screen design, page layout, "build the UI for X," turn this workflow/object into a screen, mock up a HeyHenry page.
---

# Designing HeyHenry screens

This produces a spec a designer, coding agent, or AI design tool can build from — grounded in HeyHenry's positioning, objects, workflows, roles, and the **real existing design system**. The overhaul is **structural, not a repaint**: compose what already exists, don't invent a parallel component set.

## Step 1 — Load everything

Five foundation docs (search the Ops vault `mcp__6ef61ae4-...__knowledge_search` or read by ID):
- Positioning → Interface `5bfa59be-7640-448d-ae94-71a8219bf627`
- Object Model `b4d880be-190d-4cf4-b868-3ea46a23e48a`
- Workflow Library `e0263cc3-9111-4bff-b2ec-e2a0335e12ed`
- Role × Object Matrix `03b1ccf4-3413-4e7b-a822-cadc794d821a`
- Design System Map `f9bf30bf-5515-4c04-9d4a-ba75574fbceb`

Real design system (this is what you build from):
- [PATTERNS.md](../../../PATTERNS.md) — **read first, per [AGENTS.md](../../../AGENTS.md)**; the reusable pattern families
- [DESIGN.md](../../../DESIGN.md) — in-app design rules
- [src/app/globals.css](../../../src/app/globals.css) — the real tokens
- [src/components/ui/](../../../src/components/ui/) — the 25 primitives
- [src/lib/ui/status-tokens.ts](../../../src/lib/ui/status-tokens.ts) — status → tone mapping

## Compose, don't invent

- Build from existing primitives: `button`, `card`, `badge`, `table`, `money`, `input`, `select`, `command`, `dialog`, `dropdown-menu`, `popover`, `tabs`, `skeleton`, etc.
- Reuse the documented PATTERNS.md families: pick-or-create combobox, click-to-edit inline fields, upload zones, empty states, status badges, the `{ ok, error }` server-action result shape.
- If you think you need a *new* primitive, justify it — usually you don't. Per AGENTS.md, if you change one instance of a pattern, surface its siblings for review.

## Step 2 — Frame

- **Primary object** + **workflow stage** + **role(s)** served. If any is unclear, run `heyhenry-ooux` or `heyhenry-workflow-mapping` first.
- **The one job** this screen does, and its **single primary action**.

## Step 3 — Work the spec, in this order

1. **Cockpit / next-action.** What's the headline state, and the one primary action above the fold? For a Project, use the cockpit pattern: status, next milestone, open decisions, margin snapshot, recent activity, primary action.
2. **Progressive disclosure layers.** Snapshot (always visible) → operational (daily work) → detail (review/edit) → audit (history). Decide what's inline vs collapsed vs drawer vs its own page. Don't dump everything at once; don't bury the important thing.
3. **Embedded Henry intelligence.** Where does Henry *draft / classify / summarize / OCR / spot risk* in this feature? Label AI-generated output and give it an undo. This is intelligence inside the feature — **not a chat box**, and not "make the chat bigger." See [[henry-intelligence-not-chat]].
4. **Role-aware views.** What does each relevant role see here? Enforce the homeowner boundary: never expose margin, markup, supplier cost, other customers, other jobs, or internal notes.
5. **Mobile & desktop.** Capture-first and thumb-friendly on mobile; detail layers on desktop. If it's a field surface, specify offline behavior (queue + sync, cached reads).
6. **Canadian primitives.** Where money appears: GST/HST per-line, holdback as a first-class amount, Interac e-Transfer at parity with Stripe, CAD default, T5018 where relevant.
7. **States.** Empty (icon + headline + one line + CTA), loading (skeleton), error, partial/offline. Never skip these — missing states are the most common reason a spec fails review.
8. **Visual identity.** Warm cream + rust, calm not loud, Linear-not-Buildertrend. Note: the app currently runs **stock shadcn neutral** — the brand tokens aren't wired in yet (Design System Map Gap #1), so call out where warm identity should show and don't assume it's already there.

## Step 4 — Self-check against reject-if

Before you finish, run the reject-if list (see `heyhenry-design-critique` / the Positioning doc) and fix anything that trips — per-seat implications, orphan objects, missing states, jargon, unlabeled AI, missing Canadian primitives, mobile failures, "looks like stock shadcn / Jobber."

## Output format

```
# Screen spec: <name>
**Object / workflow / role(s):** <...>   **Primary action:** <...>

## Purpose
<the one job this screen does>

## Layout
<regions top→bottom (or by column); for each region, the actual primitives/patterns to use>

## Progressive disclosure
- Snapshot (always visible): ...
- Operational: ...
- Detail (drawer/expand/page): ...
- Audit (history): ...

## Henry intelligence touchpoints
- <where + what: draft/classify/summarize/OCR/risk; how it's labeled; undo>

## Role variations
- Owner / Admin / Crew / Homeowner: <what differs; homeowner boundary>

## Mobile vs desktop
<what changes; capture-first mobile; offline if field>

## Financial / Canadian
<GST/HST, holdback, Interac, CAD, T5018 where present>

## States
Empty / Loading / Error / Offline

## Accessibility
<contrast, hit targets ≥44px, focus order, semantics>

## Open questions
<assumptions + foundation open-questions this screen surfaces>
```

## Related skills
- `heyhenry-ooux` / `heyhenry-workflow-mapping` — run first when the object or flow isn't yet clear
- `heyhenry-design-critique` — self-check the spec, or critique the built result
