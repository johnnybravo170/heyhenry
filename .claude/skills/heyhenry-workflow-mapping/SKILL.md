---
name: heyhenry-workflow-mapping
description: Map a HeyHenry contractor workflow as a state machine — trigger, states and transitions, actors and role handoffs, decision points, failure modes, approval points, Henry leverage, mobile/desktop split, and success signals — grounded in HeyHenry's canonical workflow library. Use this when designing or refining how a process works end-to-end, defining a feature's flow before drawing screens, asking "how should X work step by step," or untangling a confusing multi-step flow. Triggers on: workflow, user journey, state machine, flow design, "how should X flow work," map a process, lead-to-invoice, end-to-end, the steps for a feature, lifecycle of a process.
---

# Mapping HeyHenry workflows

Much of a contractor's work happens **outside** the app — calls, texts, site visits, supplier receipts, crew notes. If you model a workflow as states and handoffs (not just a sequence of pages), the screens fall out correctly, and the failure modes and AI leverage points surface *before* anyone draws a box. That's the job of this skill.

## Step 1 — Load the library

The **Workflow Library** is the source of truth — search the Ops vault (`mcp__6ef61ae4-...__knowledge_search`) or read by ID `e0263cc3-9111-4bff-b2ec-e2a0335e12ed`. Pair with the **Object Model** (`b4d880be-190d-4cf4-b868-3ea46a23e48a`) for the objects each state touches and the **Role × Object Matrix** (`03b1ccf4-3413-4e7b-a822-cadc794d821a`) for handoffs.

**The 9 mapped workflows — build on these, don't duplicate:**
1. Lead Intake & Triage · 2. Quoting · 3. Job Activation · 4. Field Operations Loop · 5. Change Order · 6. Job Costing · 7. Invoicing & Payment · 8. Bookkeeper Review *(deferred — separate portal)* · 9. Job Closeout

If your flow is a variant of one of these, extend it. If it's genuinely new, map it in the same shape and note how it connects to the existing ones.

## Locked conventions (don't re-litigate these)

- **Approved Quote auto-creates the Project** in Booked state — no manual "Book Job" step.
- **Approved Change Order updates the Project budget + schedule; it does NOT auto-bill.** It becomes available to include in a later, owner-initiated invoice.
- **Outbound to the customer is always human-in-the-loop** — preview before send. Henry never auto-sends external artifacts (quotes, invoices, COs, customer messages).
- **Capture-now / clean-up-later** for field work; capture must be offline-tolerant.
- **Bookkeeper flows are out of scope** for the main app (separate portal, not yet built).

## Step 2 — Map the workflow

Produce this shape:

```
## <Workflow name>
**Trigger:** <what kicks it off>
**Primary actor(s):** <roles>
**Surface:** <mobile / desktop / both>
**Objects touched:** <primary + secondary>

**State machine:** State A → State B → State C | <branch> | <terminal>

**Happy path:**
1. ...
**Decision points:** <branches + the condition>
**Failure modes:** <what goes wrong + what the UI must do about it>
**Approval points:** <internal and/or external>
**Role handoffs:** <who → who>
**Henry leverage:** <where intelligence accelerates a step>
**Mobile/desktop split:** <what's captured where>
**Success signal:** <how you know it worked>
**Open questions:** <unresolved>
```

Lead with the **state machine** (a single line of arrows) — it's the spine; everything else hangs off it.

## Cross-cutting patterns to reuse (don't redesign per-flow)

- **Approval:** every approval emits requested-at/channel/target/expiry; state is always visible on the parent object; approver can be internal user or external customer (same pattern).
- **Capture-now / clean-up-later:** field capture prioritizes speed; Henry classifies async; never block capture on categorization.
- **Henry draft → human review:** every Henry artifact lands in a review state; high-confidence low-stakes may auto-fill but never auto-send to a customer.
- **Customer notification:** always via Message Thread (preserves history); SMS for urgent, email for documents, portal for non-urgent; no login wall on customer artifacts.
- **Mobile capture, desktop review:** capture-heavy steps mobile-first; review-heavy steps desktop-first; Project Overview is the one surface that's equally critical on both.
- **Offline-tolerant field ops:** capture works offline and syncs; sends require connection and queue with an explicit state.

## Henry note

"Henry leverage" is where the **intelligence accelerates a step** — turn a voice note into a daily log, a photo set into a CO draft, a receipt into a cost entry, job activity into a margin-risk warning. It is not a chat surface. See [[henry-intelligence-not-chat]].

## Related skills
- `heyhenry-ooux` — the objects that move through these states
- `heyhenry-screen-design` — turn a workflow stage into a screen spec
- `heyhenry-design-critique` — check whether a screen supports the real workflow end-to-end
