# ContractorOS — V1 Build Spec

**Date:** 2026-04-17  
**Status:** Ready for build  
**Placeholder domain:** smartfusion.ca  
**Handed off by:** Jonathan (via planning session)

---

## Overview

Multi-tenant, AI-native business OS for trade contractors. V1 covers two verticals: renovation (Jon/JVD) and pressure washing (Will). Same platform, same codebase — verticals differ in data config and module availability, not separate apps.

The brand positioning: stress reliever, not growth tool. The thing that handles the business so the contractor can breathe.

---

## Founding Customers

### Jon (JVD) — Renovation Contractor
- Company: Connect Contracting (connectcontracting.ca)
- Location: Abbotsford, BC
- Pain: billing stress, scope creep, "how's it going?" customer calls
- Has workers (subcontractors) he needs to track time and expenses for
- Wants to walk a site with a customer, record the conversation, and have that auto-populate a quote draft
- Wants automated biweekly customer budget reports (reviewed before sending)

### Will — Pressure Washing
- Location: Abbotsford, BC
- Simpler operation — job-based (same-day completion), likely sole operator or small crew
- Pain: job logging, invoicing, schedule management
- No cost-bucket quoting — flat rate or area-based pricing

---

## Access Levels (Both Verticals)

| Feature | Owner (Jon/Will) | Worker |
|---|---|---|
| AI voice chat | ✅ | ❌ |
| Log time | ✅ | ✅ |
| Photo expense + OCR | ✅ | ✅ |
| View budget/financials | ✅ | ❌ |
| View other workers' entries | ✅ | ❌ (own only) |
| Customer reports | ✅ | ❌ |
| Quote creation | ✅ | ❌ |
| Voice memo (walk-through) | ✅ | ❌ |

Workers see a stripped-down app: clock in/out on a project + bucket, photo a receipt and tag it. Nothing else.

---

## Shared Core (Both Verticals)

### 1. Auth + Multi-Tenancy
- Owner account creates the workspace
- Owner invites workers (link or code)
- Workers scoped to their own entries only
- Multi-tenant: each contractor's data is isolated

### 2. AI Voice Chat
- Primary interface for owners
- Persistent conversation thread (see AI Architecture section)
- Voice input + text input both supported
- Jon: project-scoped thread
- Will: business-scoped thread (jobs are too short for per-job threads)

### 3. Receipt Capture + OCR
- Worker or owner photos a receipt
- AI extracts: vendor, amount, date
- User confirms and tags: project + cost bucket (Jon) or job (Will)
- Receipt image stored, linked to expense record

### 4. Time Logging
- Select project (Jon) or job (Will)
- Select cost bucket (Jon only)
- Enter hours + optional note
- Owner can log for any worker; worker logs for themselves only

### 5. Customer / Project Management
- Customer records: name, contact info
- Jon: projects (multi-week, have cost buckets, linked to a customer)
- Will: jobs (single-day, linked to a customer or address)

---

## Jon's Vertical — Renovation Module

### Cost Bucket System

Every project has a set of cost buckets, seeded from the renovation template. Buckets are editable per project.

**Default renovation bucket template** (from JVD's real quote format):

Interior: Demo, Disposal, Framing, Plumbing, Plumbing Fixtures, HVAC, Insulation, Drywall, Flooring, Doors & Mouldings, Windows & Doors, Railings, Electrical, Painting, Kitchen, Contingency

Exterior: Demo, Disposal, Framing, Siding, Sheathing, Painting, Gutters, Front Garden, Front Door, Rot Repair, Garage Doors, Contingency

**Pricing formula** (from JVD's actual spreadsheet):
```
Sum of all bucket estimates (ex-GST)
+ 12% Management Fee
+ 5% GST
= Total
```

### Quote Creation

Two paths:

**Manual:** Jon creates a project, adds cost buckets, enters estimates per bucket, generates quote PDF in his preferred format (Task | Description | Estimate, Interior/Exterior sections).

**Voice Memo → Quote Draft (key feature):**
1. Jon hits Record in the app while walking a site with the customer
2. They talk through rooms, scope, issues, preferences
3. Jon stops recording — audio uploads in background (native phone audio, not in-app streaming — V1 simplicity)
4. AI transcribes and extracts:
   - Areas/rooms mentioned
   - Work items per area → mapped to cost buckets
   - Customer preferences and concerns flagged
   - Uncertainty flags ("we talked about X but maybe not")
5. Output: pre-populated quote draft with descriptions filled, dollar amounts blank
6. Jon reviews, adds numbers, sends

The transcript is stored and linked to the project. It becomes part of the AI chat context.

### Biweekly Customer Progress Reports

**Generation:** System auto-generates a draft every two weeks per active project. Report shows:
- Budget vs actual per cost bucket (amounts, % used)
- Overall project % complete (Jon sets this manually or via milestone)
- Optional: site photo slot
- Tone: professional, reassuring, clear — not a spreadsheet dump

**Gating workflow (polished approval queue):**
1. Push notification to Jon: *"Draft report ready — Kutney Suite"*
2. Jon opens app to a rendered preview that looks exactly like the customer will receive
3. Inline editing: tap any line to adjust copy; toggle individual buckets visible/hidden (some cost details may be sensitive)
4. "Send to [Customer Name]" button — fires email, logs sent timestamp
5. Snooze 48h option if timing is bad
6. Escalating reminder if not acted on (don't auto-send in V1)

**Design principle:** Jon should open this screen, skim it, feel proud of it, and hit send. If it requires significant editing before it's sendable, the AI generation prompt needs tuning — not the UI.

---

## Will's Vertical — Pressure Washing Module

- Job-based (not project-based) — single visit, done same day
- Simple pricing: flat rate or area-based (aerial/map quoting is post-V1)
- AI chat is business-level: "log today's jobs", "what's my schedule", "send an invoice for Henderson"
- Time logging per job (not cost buckets)
- Expense logging per job
- Invoice generation from job record

---

## AI Architecture

### Two Types of Context — Keep Them Separate

**Structured data (query the DB, don't embed):**
- Time entries, expense amounts, budget figures, cost bucket totals
- When Jon asks "what did we spend on framing?", this is a DB query
- AI receives a structured context block: `Framing budget: $4,393 | Spent: $2,847 | Remaining: $1,546`

**Unstructured text (retrieval candidates):**
- Voice memo transcripts
- Project notes, customer observations
- AI chat history

### V1 RAG Strategy — Keep It Simple

No vector DB in V1. Projects will have 5–15 memos at most.

- Store all transcripts as text, linked to project
- Include all transcripts for the active project in context (they'll fit)
- Fall back to keyword search if a project gets many memos
- Add vector embeddings + semantic search in V2 when cross-project search is needed or context gets crowded

### Conversation Threading

**Jon:** Per-project thread. AI has full context for that project. Jon navigates between project threads.

**Will:** Single business-level thread. Jobs are too short for per-job threads; Will needs to ask cross-job questions.

### Context Block Composition (per AI query)

```
System prompt
├── Tenant identity (owner name, company, vertical)
├── Current project/context overview

Structured context (fresh DB query)
├── Budget vs actual per bucket (Jon) or recent job summary (Will)
├── Time entries — last 7 days
└── Expenses — last 7 days

Conversation history
└── Last ~20 turns (summarize older turns, keep structured data current)

Memo transcripts (Jon only)
└── All transcripts for active project (V1: include all; V2: retrieve by relevance)
```

### Model
Use Claude claude-sonnet-4-6 (`claude-sonnet-4-6`) for all AI features. Include prompt caching on system prompt + structured context block (these are stable across turns).

---

## Data Model

```
tenants
  id, name, vertical (renovation | pressure_washing), owner_user_id, created_at

users
  id, tenant_id, name, email, role (owner | worker), created_at

customers
  id, tenant_id, name, email, phone, address, created_at

projects  [Jon vertical]
  id, tenant_id, customer_id, name, status, phase, start_date, created_at

cost_buckets  [Jon vertical]
  id, project_id, name, section (interior | exterior), estimate_ex_gst, display_order

jobs  [Will vertical]
  id, tenant_id, customer_id, address, status, scheduled_date, flat_rate, created_at

time_entries
  id, tenant_id, user_id
  project_id (nullable, Jon), bucket_id (nullable, Jon)
  job_id (nullable, Will)
  hours, notes, entry_date, created_at

expenses
  id, tenant_id, user_id
  project_id (nullable, Jon), bucket_id (nullable, Jon)
  job_id (nullable, Will)
  amount, vendor, receipt_url, expense_date, created_at

memos  [Jon vertical]
  id, project_id, audio_url, transcript, created_at

customer_reports  [Jon vertical]
  id, project_id, draft_content, status (draft | approved | sent)
  generated_at, approved_at, sent_at

conversation_threads
  id, tenant_id, user_id
  project_id (nullable — null = business-level thread for Will)
  created_at

conversation_messages
  id, thread_id, role (user | assistant), content, created_at
```

---

## V1 Scope — What's In / What's Deferred

### In V1
- Auth, multi-tenancy, owner + worker roles
- Jon vertical: projects, cost buckets, manual quote creation, time/expense logging per bucket
- Will vertical: jobs, time/expense logging, basic invoicing
- Receipt photo + OCR + tagging (both)
- AI voice chat for owners (both)
- Voice memo record + upload + transcription → quote draft (Jon)
- Biweekly report generation + polished approval queue (Jon)
- Push notifications for report drafts

### Deferred (Post-V1)
- Aerial/map-based quoting (Will)
- Vector DB / semantic memo search
- Customer-facing portal (report delivered by email V1)
- Cross-project AI queries
- Mobile-native offline mode
- John (tile vertical) — planning week of 2026-04-21
- Invoicing integrations (QuickBooks, etc.)
- Photo progress documentation tied to reports

---

## Open Questions (resolve before or early in build)

1. **Tech stack preference?** React Native for mobile? Next.js web app? Or web-first with PWA for workers?
2. **Hosting?** Vercel + Supabase pattern (matches connectcontracting.ca build) or different?
3. **Email delivery for reports?** Resend (already used for JVD's website contact form) makes sense.
4. **Audio transcription?** Whisper API or Deepgram? Deepgram is faster/cheaper for real-time; Whisper is fine for upload-and-transcribe (V1 is upload, so either works).
5. **Payment / billing for the SaaS itself?** Stripe, monthly per-seat? Deferred but good to decide before user table design.
6. **Report format?** Email HTML or PDF attachment or both?
