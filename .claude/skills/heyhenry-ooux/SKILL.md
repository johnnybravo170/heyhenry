---
name: heyhenry-ooux
description: Model the objects and information architecture for a HeyHenry feature using Object-Oriented UX — producing an object map (definition, fields, relationships, lifecycle states, actions, role visibility, Henry opportunities, navigation implications) grounded FIRST in the real schema, then the canonical Object Model. Use this when designing a new HeyHenry feature, restructuring navigation or IA, deciding where something should "live," checking whether a feature fits the object model, or when a screen feels like an orphaned item on a feature list. Triggers on: object model, OOUX, information architecture / IA, "what objects or entities does X involve," "where should X live," navigation structure, model a feature, entity relationships, data model for a feature.
---

# Modeling HeyHenry objects & IA

OOUX keeps the product intuitive by structuring around the real things contractors hold in their heads — **Projects, Customers, Quotes, Invoices, Photos**. Design from objects + relationships, not a feature checklist. Target: **GC vertical**; the work container is the **Project** (`jobs` is deprecated carryover).

## Step 0 — Ground in the real schema first

The Object Model doc is reconciled to the schema, but for any specific feature, **verify against the real tables/enums** in `supabase/migrations/`, plus the feature code in `src/components/features/<area>/` and `src/server/actions/`. The schema is **current-state truth**; the Object Model is the design-level view + clearly-flagged target deltas. Don't model objects from memory — that's how the foundation drifted into fiction before.

## Step 1 — The canonical objects (reconciled, real)

Source of truth: **Object Model `b4d880be`** (reconciled 2026-05-20) + Role × Object Matrix `03b1ccf4` + IA & Nav Map `6529e9ae`. Reuse these real objects:

- **Contacts/Sales:** Customer (`customers`; `kind` ∈ lead | customer | vendor | sub | …), Quote (+ line items), Materials Catalog (pricebook)
- **Project:** Project (`projects` — the container), Project Phase, Budget (categories + cost lines), Change Order (+ lines)
- **Field/activity:** Task, Time Entry, Photo, Worklog Entry, Project Memo, Project Document, Note/Selection/Idea
- **Financial:** Project Cost (unified), Payment Source, Invoice, Purchase Order
- **Intake/comms:** Intake Draft (the inbox pipeline), Inbound Email, Project Message
- **Customer-facing:** Pulse Update, Project Decision (public portal)
- **People:** Tenant, Tenant Member (owner | admin | member | worker | bookkeeper), Worker Profile

**Assumed-but-absent (do NOT invent):** there is no `leads`/`calls`/`approvals`/`message_threads`/`schedule_events`/`daily_logs` table. Leads are `customers.kind='lead'`; approvals are an `approval_code`+status on change orders/decisions; field capture is photos+worklog+memos. See the Object Model's "assumed-but-absent" table.

## Non-negotiables
- **Projects are gravity.** Most objects link back to a Project or Customer. If your new thing links to neither, reconsider.
- **No orphan features.** A global page with no parent object is a smell.
- **A "new object" is a real conversation** — first confirm it isn't already in the schema under another name.

## Step 2 — Map each object the feature touches
```
### <Object>
- Definition · Key fields · Lifecycle (real status values) · Primary/secondary actions
- Relationships (→ other objects) · Role visibility (Owner/Admin/Member/Worker/Homeowner)
- Henry opportunities (draft/classify/summarize/OCR/risk) · Mobile vs desktop · Open questions
```
If the object's already in the Object Model, note "per Object Model" and capture only what's new.

## Step 3 — IA / navigation implications
- **Where it lives:** the GC nav is Dashboard · Business Health · Contacts · Inbox · Projects · Quotes · Invoices · Expenses · Settings (nav is DB-driven per vertical).
- **Object-detail tabs:** Project = Budget / Spend / Time / Schedule / Customer Billing / Overview + secondary (Messages/Gallery/Portal/Selections/Documents/Notes/Crew).
- **Entry points:** list view, links from related objects. (No global command palette today.)

## Henry note
"Henry opportunities" = where intelligence helps with this object (draft/classify/summarize/OCR/risk-spot). Not "add a chat about this object." See [[henry-intelligence-not-chat]].

## Output
One-paragraph summary (primary object, how it relates to the Project, its IA home) → per-object maps → nav implications → open questions.

## Related skills
- `heyhenry-workflow-mapping` — how these objects move through states
- `heyhenry-screen-design` — turn the object map into a screen spec
- `heyhenry-design-critique` — audit a feature for orphan-object / IA problems
