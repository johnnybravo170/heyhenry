---
name: heyhenry-design-critique
description: Evaluate any HeyHenry screen, mockup, or AI-generated UI against HeyHenry's positioning, object model, workflows, roles, and design system — producing a 1-5 scored rubric, a "reject-if" pass, and a prioritized punch list. Use this whenever reviewing, auditing, or critiquing a HeyHenry screen or design — an existing screen, a redesign, a Claude Design output, or a wireframe — even if the user only says "what do you think of this screen," "is this any good," or "review this page." Triggers on: critique/review/audit a HeyHenry screen, evaluate a design, design QA, redesign feedback, AI-generated UI review, "is this screen good."
---

# Critiquing HeyHenry screens

The point of this skill is to judge a screen on **workflow clarity and positioning fit**, not just visual taste. A prettier version of a confusing screen is still a failure. Good critique here is grounded in what HeyHenry is for and who is using it — so the feedback survives past this one screen.

## Step 1 — Load the foundation

These five docs live in the **Ops knowledge vault** (search via `mcp__6ef61ae4-...__knowledge_search`, or read by the IDs below). Pull the ones relevant to the screen; you don't always need all five, but you must know the positioning + object + workflow context before scoring.

- **Positioning → Interface Translation** — `5bfa59be-7640-448d-ae94-71a8219bf627` (the five promises, what every screen must do, the reject-if list)
- **Object Model** — `b4d880be-190d-4cf4-b868-3ea46a23e48a` (the 20 objects, lifecycles, role visibility)
- **Workflow Library** — `e0263cc3-9111-4bff-b2ec-e2a0335e12ed` (9 workflows, failure modes, Henry leverage)
- **Role × Object Matrix** — `03b1ccf4-3413-4e7b-a822-cadc794d821a` (permissions + the homeowner boundary)
- **Design System Map** — `f9bf30bf-5515-4c04-9d4a-ba75574fbceb` (real tokens/components + gaps)

Also skim the real design system so "implementation practicality" is grounded: [PATTERNS.md](../../../PATTERNS.md), [DESIGN.md](../../../DESIGN.md), [src/components/ui/](../../../src/components/ui/), [src/lib/ui/status-tokens.ts](../../../src/lib/ui/status-tokens.ts).

## The lens — what "good" means for HeyHenry

- **Jobs are gravity.** Customers, quotes, invoices, photos all orient around a Project. Orphan features (a thing with no clear parent object) are a smell.
- **Henry is the intelligence behind features, not a chat.** Reward a screen for embedding Henry's intelligence where it obviously helps (voice-to-quote, receipt OCR, photo classification, margin-risk, drafting). Do **not** reward or penalize based on whether a chat box is present — the sidebar chat is a separate, fine-as-is surface. Never recommend "add a chat here" or "make Henry bigger."
- **Calm and warm, not loud or generic.** The app should feel like Linear with a warm identity (cream + rust), not stock shadcn and not faux-construction (no hard hats / caution-tape palettes).
- **Canadian by default** where money appears (GST/HST per-line, holdback, Interac, CAD, T5018).
- **Capture in the truck, finish at the desk.** Field surfaces are mobile-first, capture-fast, offline-tolerant.

## Step 2 — Frame the screen

Establish before scoring (infer and **state your assumption** if not given):
- **Role** it serves: Owner / Admin / Crew / Homeowner
- **Primary object** it renders (Project, Quote, Invoice, Daily Log, …)
- **Workflow** it supports and where in that flow it sits

If you have a live URL, view it with the preview tools. If a screenshot, read it carefully. If only a description, critique from that and note the limitation explicitly.

## Step 3 — Score the rubric (1–5)

Score conservatively — a 5 is rare and means "exemplary, ship it." Mark **N/A** for dimensions that don't apply (e.g. financial clarity on a photo gallery). Give each score a one-line piece of evidence.

| # | Dimension | What a high score looks like | Anchor doc |
|---|---|---|---|
| 1 | Positioning fit | Feels like HeyHenry — warm, calm, contractor-native; not stock shadcn or generic SaaS | Positioning |
| 2 | User & task clarity | The primary user and what they're here to do is obvious in 2 seconds | Positioning |
| 3 | Next action | One obvious primary action; "what do I do next" is answered above the fold | Positioning |
| 4 | Workflow fit | Supports the real job-to-be-done end-to-end; handles the workflow's failure modes | Workflow Library |
| 5 | Object clarity | Relevant objects + relationships are legible; Jobs stay central; no orphan feature | Object Model |
| 6 | Progressive disclosure | Complexity is layered (snapshot → operational → detail → audit), not dumped | Positioning |
| 7 | AI-native (Henry) | Henry's intelligence shows up at a real leverage point in the feature (NOT chat presence) | Positioning / [[henry-intelligence-not-chat]] |
| 8 | Trust & auditability | Approval state visible; AI artifacts labeled + undoable; activity/audit reachable | Object Model |
| 9 | Role-appropriateness | Shows the right slice for the role; homeowner boundary respected (no margin/markup/other jobs) | Role Matrix |
| 10 | Mobile/field viability | Works one-handed in sunlight; capture-first; offline-tolerant where relevant | Positioning / Workflow |
| 11 | Financial clarity | Cost / margin / payment / holdback / tax are understandable where present | Object Model |
| 12 | Canadian primitives | GST/HST per-line, holdback, Interac, CAD, T5018 present where they belong | Positioning |
| 13 | Accessibility | WCAG 2.2 AA intent: contrast, hit targets ≥44px, visible focus, semantic structure | Design System |
| 14 | Implementation practicality | Composes existing primitives + PATTERNS.md; buildable without inventing primitives | Design System Map |

## Step 4 — Run the reject-if pass

Flag any that trip (these are hard fails worth calling out regardless of rubric average):
- A feature that should be AI-native isn't — Henry's intelligence is missing where it would obviously help. *(A sidebar chat is fine; the fail is missing embedded intelligence, not a missing chat box.)*
- Implies per-seat limits anywhere ("X of Y seats used", upgrade-to-add-user)
- A Customer or Invoice exists with no Job context
- Last-name-required fields, login walls on customer artifacts, or seat counters
- Dashboard reports numbers instead of prompting action
- Approval state is implicit instead of visible
- Construction jargon where plain English would do
- Looks like Jobber / Buildertrend / Housecall Pro / stock shadcn with a new coat of paint
- AI output shown without a label or an undo
- Mobile usability fails (form too long, hit targets too small, requires typing to capture)
- Canadian primitives absent where they belong
- Adds a tab to the contractor's workflow instead of removing one

## Step 5 — Output

Use this structure:

```
# Critique: <Screen name> (<role>)
_Assumptions: <role / workflow / object if inferred>_

## Verdict
<one or two sentences: Ship / Fix-first / Rework — and the core reason>

## Rubric
| # | Dimension | Score | Evidence |
|---|---|---|---|
... (only scored + N/A rows)
**Strong:** <dimensions> · **Weak:** <dimensions>

## Reject-if check
<each tripped item + why, or "none tripped">

## What works (keep)
- ...

## Punch list (prioritized)
1. **[P1]** <fix> — _<which principle/doc>_
2. **[P2]** ...
3. **[P3]** ...

## Open questions
- <anything you had to assume, or a foundation open-question this screen surfaces>
```

Every criticism gets a concrete, buildable fix — name the primitive or pattern to use. Be honest over flattering; the value of this skill is catching the confusing-but-pretty screen.

## Related skills
- `heyhenry-screen-design` — when the verdict is "rework," hand the punch list to this skill to produce the new spec.
- `heyhenry-ooux` / `heyhenry-workflow-mapping` — if object or workflow gaps are the root cause, model them first.
