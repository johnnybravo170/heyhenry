---
name: heyhenry-ooux
description: Model the objects and information architecture for a HeyHenry feature or area using Object-Oriented UX — producing an object map (definition, fields, relationships, lifecycle states, actions, role visibility, Henry opportunities, navigation implications) grounded in HeyHenry's canonical object model. Use this when designing a new HeyHenry feature, restructuring navigation or IA, deciding where something should "live," checking whether a feature fits the object model, or when a screen feels like an orphaned item on a feature list. Triggers on: object model, OOUX, information architecture / IA, "what objects or entities does X involve," "where should X live," navigation structure, model a feature, entity relationships, data model for a feature.
---

# Modeling HeyHenry objects & IA

HeyHenry gets confusing when features are designed as a checklist of screens. Object-Oriented UX keeps it intuitive by structuring around the real things contractors already hold in their heads — Jobs, Customers, Quotes, Invoices, Photos. **Design from objects and relationships, not from a feature list.**

## Step 1 — Load the canonical model

The **Object Model** doc is the source of truth — search the Ops vault (`mcp__6ef61ae4-...__knowledge_search`) or read by ID `b4d880be-190d-4cf4-b868-3ea46a23e48a`. Pair it with the **Role × Object Matrix** (`03b1ccf4-3413-4e7b-a822-cadc794d821a`) for visibility rules. For field-level truth, the real schema is in [the app](../../../src) (migrations under `supabase/`), but design-level work usually stays above that.

**The 20 canonical objects — reuse these, don't reinvent:**
- *Sales:* Lead, Customer, Project (Job), Quote, Catalog Item
- *Operational:* Change Order, Task, Schedule Event, Daily Log, Photo, Document, Project Cost
- *Financial:* Invoice, Payment
- *Communication:* Message Thread, Call
- *Decision/System:* Approval, Henry Action, Audit Event
- *People:* User (roles: Owner, Admin, Crew, Homeowner — Bookkeeper is a deferred separate portal)

## The non-negotiables

- **Jobs (Projects) are gravity.** Most objects link back to a Project, Customer, Lead, or Property. If your new thing links to none of them, that's a flag — reconsider.
- **No orphan features.** A global "X" page with no parent object is a smell. Even global Photos/Documents/Tasks views must carry job attribution.
- **Polymorphic objects** (Photo, Document, Approval, Henry Action, Audit Event) attach to multiple hosts — always preserve the "what is this attached to" context in any design.
- **A genuinely new object is a real conversation.** If the feature doesn't fit the 20, extend the model deliberately (and flag it), don't invent an object silently.

## Step 2 — Map each object the feature touches

Produce this for each:

```
### <Object>
- Definition: <one plain-English sentence>
- Key fields: <the attributes that matter for this feature>
- Lifecycle: <state → state → state>
- Primary actions: <the verbs that dominate>
- Secondary actions: <less common but needed>
- Relationships: <→ other objects, with cardinality>
- Role visibility: Owner / Admin / Crew / Homeowner (scope each)
- Henry opportunities: <where intelligence helps — draft/classify/summarize/OCR/risk-spot>
- Mobile vs desktop: <primary surface>
- Open questions: <anything unresolved>
```

If the object already exists in the canonical model, don't restate the whole thing — note "per Object Model" and capture only what's new or specific to this feature.

## Step 3 — Derive IA / navigation implications

- **Where it lives:** which primary nav area, or which object's detail tabs
- **Object-detail structure:** for Project-centric work, use the cockpit pattern (status, next milestone, open decisions, margin snapshot, primary action)
- **Entry points:** list view, global search, command palette, links from related objects
- **What does NOT belong in primary nav** (keep it lean — the product gets stronger as nav/settings shrink)

## Henry note

"Henry opportunities" means **where the intelligence helps with this object** — drafting it, classifying it, summarizing it, OCR-ing it, spotting risk on it. It does **not** mean "add a chat about this object." See [[henry-intelligence-not-chat]].

## Output

Lead with a one-paragraph summary (primary object, how it relates to Jobs, the IA home), then the per-object maps, then the nav implications, then open questions. Keep it skimmable.

## Related skills
- `heyhenry-workflow-mapping` — how these objects move through states together over time
- `heyhenry-screen-design` — turn the object map into a screen spec
- `heyhenry-design-critique` — audit an existing feature for orphan-object / IA problems
