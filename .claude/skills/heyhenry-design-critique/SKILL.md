---
name: heyhenry-design-critique
description: Evaluate any HeyHenry screen, mockup, or AI-generated UI against HeyHenry's positioning, real object model, workflows, roles, and design system — producing a 1-5 scored rubric, a "reject-if" pass, and a prioritized punch list. Use this whenever reviewing, auditing, or critiquing a HeyHenry screen or design — an existing screen, a redesign, an Open Design / Claude Design output, or a wireframe — even if the user only says "what do you think of this screen," "is this any good," or "review this page." Triggers on: critique/review/audit a HeyHenry screen, evaluate a design, design QA, redesign feedback, AI-generated UI review, "is this screen good."
---

# Critiquing HeyHenry screens

Judge a screen on **workflow clarity, positioning fit, and fidelity to the real product** — not visual taste. A prettier version of a confusing screen is still a failure; so is a beautiful screen built on an object model that doesn't exist (that's how the first Inbox design went wrong).

## Step 1 — Load the foundation
Six docs in the Ops vault (search `mcp__6ef61ae4-...__knowledge_search` or read by ID; all reconciled to the code 2026-05-20):
- **Positioning** `5bfa59be` (the promises, must-do list, reject-if)
- **Object Model** `b4d880be` (the real objects + enums + lifecycles)
- **Workflow Library** `e0263cc3` (real flows, failure modes, Henry leverage)
- **Role × Object Matrix** `03b1ccf4` (real roles + the homeowner boundary)
- **Design System Map** `f9bf30bf` (real tokens/components)
- **IA & Nav Map** `6529e9ae` (real nav, object tabs)

Also skim the real system for "implementation practicality": [PATTERNS.md](../../../PATTERNS.md), [DESIGN.md](../../../DESIGN.md), [components/ui/](../../../src/components/ui/), [status-tokens.ts](../../../src/lib/ui/status-tokens.ts). If the screen claims to be a *current* surface, sanity-check it against the real route/schema/actions.

## The lens — what "good" means for HeyHenry
- **Grounded in reality.** The screen models objects + flows that actually exist (real tables/enums/actions), or clearly-flagged target changes — not an idealized invention.
- **Projects are gravity.** Customers, quotes, costs, invoices, photos orient around a Project. Orphan features (no clear parent object) are a smell.
- **Henry is the intelligence behind features, not a chat.** Reward embedded intelligence where it helps (intake classify/extract, voice→quote, receipt OCR, photo auto-tag, Pulse drafting, risk-spotting). Do **not** reward/penalize a chat box — the sidebar chat is fine as-is. Never recommend "add a chat" or "make Henry bigger."
- **Calm and warm, not loud or generic.** Feel like Linear with the warm "Paper" identity (cream + rust, now live), not stock shadcn, not faux-construction.
- **Canadian where money appears** (GST/HST, Interac e-Transfer, CAD).
- **Capture in the truck, finish at the desk.** Field surfaces mobile-first, capture-fast, offline-tolerant.

## Step 2 — Frame the screen
Establish (infer + **state assumptions** if not given): **Role** (Owner / Admin / Member / Worker / Homeowner-portal) · **Primary object** (Project, Quote, Invoice, Intake Draft, …) · **Workflow** + where in it. View live URLs with the preview tools; read screenshots carefully; if only a description, note the limitation.

## Step 3 — Score the rubric (1–5)
Score conservatively (5 is rare). Mark **N/A** where a dimension doesn't apply. One line of evidence each.

| # | Dimension | High score | Anchor |
|---|---|---|---|
| 1 | Positioning fit | Warm, calm, contractor-native; not stock shadcn / generic SaaS | Positioning |
| 2 | Grounded in reality | Models real objects/flows (or flagged target), not invented ones | Object Model / Workflow |
| 3 | User & task clarity | Primary user + their job obvious in 2s | Positioning |
| 4 | Next action | One obvious primary action above the fold | Positioning |
| 5 | Workflow fit | Supports the real job-to-be-done; handles failure modes | Workflow Library |
| 6 | Object clarity | Relevant objects/relationships legible; Project central; no orphan | Object Model |
| 7 | Progressive disclosure | Layered (snapshot→operational→detail→audit), not dumped | Positioning |
| 8 | AI-native (Henry) | Intelligence at a real leverage point (NOT chat presence) | [[henry-intelligence-not-chat]] |
| 9 | Trust & auditability | Approval state visible; AI labeled + undoable; activity reachable | Object Model |
| 10 | Role-appropriateness | Right slice for the role; homeowner boundary respected | Role Matrix |
| 11 | Mobile/field viability | One-handed in sunlight; capture-first; offline-tolerant | Positioning / Workflow |
| 12 | Financial clarity | Cost / margin / payment / tax understandable where present | Object Model |
| 13 | Canadian primitives | GST/HST, Interac, CAD present where they belong | Positioning |
| 14 | Accessibility | WCAG 2.2 AA: contrast, ≥44px targets, focus, semantics | Design System |
| 15 | Implementation practicality | Composes existing primitives + PATTERNS.md | Design System Map |

## Step 4 — Reject-if pass (hard fails, regardless of average)
- **Designed against an idealized model** — objects or flows that don't exist in the schema/actions (and not flagged as target).
- A feature that should be AI-native isn't. *(A sidebar chat is fine; the fail is missing embedded intelligence.)*
- Implies per-seat limits anywhere.
- A Customer or Invoice with no **Project** context.
- Last-name-required fields, login walls on customer artifacts, seat counters.
- Dashboard reports instead of prompting action.
- Approval state implicit instead of visible.
- Construction jargon where plain English would do.
- Looks like Jobber / Buildertrend / Housecall Pro / stock shadcn.
- AI output without a label or undo.
- Mobile usability fails.
- Canadian primitives absent where they belong.
- Adds a tab instead of removing one.

## Step 5 — Output
```
# Critique: <Screen> (<role>)
_Assumptions: <role / workflow / object>_
## Verdict   <Ship / Fix-first / Rework — core reason>
## Rubric    | # | Dimension | Score | Evidence |   (+ Strong / Weak)
## Reject-if check   <tripped items + why, or "none">
## What works (keep)
## Punch list (prioritized)   [P1]/[P2]/[P3] — each tied to a doc/principle
## Open questions
```
Every criticism gets a concrete, buildable fix (name the primitive/pattern). Honest over flattering — the value is catching the confusing-but-pretty (or pretty-but-fictional) screen.

## Related skills
- `heyhenry-screen-design` — when the verdict is "rework," hand it the punch list.
- `heyhenry-ooux` / `heyhenry-workflow-mapping` — if object/workflow gaps are the root cause.
