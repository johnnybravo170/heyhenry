---
name: heyhenry-screen-design
description: Generate a build-ready screen spec for a HeyHenry page — layout from the app's existing shadcn/ui primitives and PATTERNS.md, with progressive disclosure, role-aware views, embedded Henry intelligence, mobile/desktop behavior, Canadian financial primitives, and empty/loading/error states. Grounded FIRST in the real implementation, then the foundation docs. Use this when designing, specing, or redesigning a HeyHenry screen, laying out a page, or turning a critique punch list, object map, or workflow into a concrete screen. Triggers on: design the X screen, spec a page, redesign a screen, lay out a view, screen design, page layout, "build the UI for X," turn this workflow/object into a screen, mock up a HeyHenry page.
---

# Designing HeyHenry screens

Produces a spec a designer, coding agent, or AI design tool can build from. The overhaul is **structural, not a repaint** — compose what already exists. Target: **GC vertical**; the work container is the **Project**.

## Step 0 — Ground in the real implementation (do this FIRST)

**Never write a brief from the foundation docs alone — that is exactly how the first Inbox brief went wrong** (it described a communications inbox that doesn't exist). Before anything, read the ACTUAL current implementation of the area you're designing:

- **Route:** find it under `src/app/(dashboard|worker|public)/...`
- **Data model:** the real tables/enums in `supabase/migrations/` (and the entity in the Object Model)
- **Server actions:** `src/server/actions/` — the real flow + status values
- **Existing UI:** `src/components/features/<area>/`

The foundation docs are the **target/direction**; the code is **current-state truth**; your brief is the **delta** between them. If a doc and the code disagree on what exists today, **the code wins** — flag the divergence. In the brief, state plainly what's current vs. what's a target change.

## Step 1 — Load the foundation (the target layer)

Six docs (Ops vault — search or read by ID; all reconciled to the code 2026-05-20, each separating current-truth from target-deltas):
Positioning `5bfa59be` · Object Model `b4d880be` · Workflow Library `e0263cc3` · Role × Object Matrix `03b1ccf4` · Design System Map `f9bf30bf` · IA & Nav Map `6529e9ae`.

Real design system (build from this): [PATTERNS.md](../../../PATTERNS.md) (read first per [AGENTS.md](../../../AGENTS.md)) · [DESIGN.md](../../../DESIGN.md) · [globals.css](../../../src/app/globals.css) (the warm "Paper" palette is **live**) · [components/ui/](../../../src/components/ui/) · [status-tokens.ts](../../../src/lib/ui/status-tokens.ts).

## Compose, don't invent
Build from existing primitives (`button`, `card`, `badge`, `table`, `money`, `input`, `select`, `command`, `dialog`, `dropdown-menu`, `popover`, `tabs`, `skeleton`) and PATTERNS.md families (pick-or-create, click-to-edit, upload zones, empty states, status badges, `{ ok, error }` action shape). Justify any new primitive — usually you don't need one.

## Step 2 — Frame
Primary object + workflow stage + role(s) served (run `heyhenry-ooux`/`heyhenry-workflow-mapping` if unclear). The one job + the single primary action.

## Step 3 — Work the spec, in order
1. **Cockpit / next-action** — headline state + the one primary action above the fold.
2. **Progressive disclosure** — snapshot → operational → detail → audit; inline vs collapsed vs drawer vs page.
3. **Embedded Henry intelligence** — where Henry drafts/classifies/extracts/summarizes/risk-spots *in this feature*; labeled + undoable. **Not a chat box.** See [[henry-intelligence-not-chat]].
4. **Role-aware** — Owner/Admin/Member (dashboard), Worker (`/w`), Homeowner (public portal). Homeowner boundary: never expose margin, markup, supplier cost, other customers, other projects, internal notes, or unshared photos.
5. **Mobile & desktop** — capture-first/thumb-friendly mobile; detail layers desktop; offline behavior if it's a field surface.
6. **Canadian primitives** — GST/HST on money, **Interac e-Transfer at parity with Stripe**, CAD default. *(No holdback. T5018/year-end live in the bookkeeper portal — out of scope.)*
7. **States** — empty (icon + headline + line + CTA), loading (skeleton), error, offline. Never skip these.
8. **Visual identity** — warm cream + rust ("Paper" palette is **live** in globals.css — design to it), calm not loud, Linear-not-Buildertrend.

## Step 4 — Self-check against reject-if
Run the reject-if list (see `heyhenry-design-critique` / Positioning) and fix anything that trips.

## Output format
```
# Screen spec: <name>
**Object / workflow / role(s):** <...>   **Primary action:** <...>
## Purpose
## Layout            <regions; the real primitives/patterns per region>
## Progressive disclosure   Snapshot / Operational / Detail / Audit
## Henry intelligence touchpoints   <where + what; labeled; undo>
## Role variations   Owner / Admin / Member / Worker / Homeowner(portal)
## Mobile vs desktop
## Financial / Canadian   <GST/HST, Interac, CAD where present>
## States   Empty / Loading / Error / Offline
## Accessibility   <contrast, ≥44px targets, focus, semantics>
## Open questions   <assumptions; current-vs-target deltas this screen surfaces>
```

## Related skills
- `heyhenry-ooux` / `heyhenry-workflow-mapping` — run first when object or flow isn't clear
- `heyhenry-design-critique` — self-check the spec, or critique the built result
