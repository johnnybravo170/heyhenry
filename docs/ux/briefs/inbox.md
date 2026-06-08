# OD Brief — Inbox (Intake · Todos · Work log)

> **Status:** Draft 2 — **regrounded against the real implementation.** Draft 1 described a communications-triage inbox (Leads/Messages/Calls/Approvals) that does not exist; this replaces it.
> **Grounded in:** `src/app/(dashboard)/inbox/*`, the `intake_drafts` schema (`supabase/migrations/`), `src/server/actions/inbox-intake.ts`. Foundation docs = the target layer.
> **How to use:** paste into a new OD project (HeyHenry "Paper" design system); generate **hi-fi desktop (master–detail) + mobile**; then run `heyhenry-design-critique`.

**Real model:** the Inbox is a 3-tab surface — **Intake · Todos · Work log** ("Henry's intake activity, your todos, and the work log — all in one place"). **Roles:** owner / admin / member (dashboard). **Primary object:** `intake_drafts`. **Primary action:** **Apply** a staged draft to its destination.

## Purpose
Henry ingests messy inputs — forwarded emails, lead-form submissions, dropped files, voice memos — **classifies + extracts** each one, and **stages** it for the operator to confirm. The operator reviews Henry's read, corrects if needed, and **Applies** each item to where it belongs (a cost, a document, a photo, a message, a new project). Their todos and a work-log feed share the surface.

## Layout — Intake tab (master–detail)
- **Header:** "Inbox" + tab nav **Intake (n) · Todos (n) · Work log (n)** with live counts. On Intake, a calm banner: *"Forward bills, sub-quotes, drawings, photos, customer emails — anything — to henry@inbound.heyhenry.io. Henry classifies and stages each one for your confirmation."* Filters: **Search · Source · Status**.
- **List (left / full-width mobile):** one card per `intake_draft` — **source** chip (email / lead form / drop / voice / web share) · Henry's **classified intent** (vendor bill / sub-quote / document / photo / message / new lead) · one-line summary · age · **status** (Needs review / Needs action / Error) · primary button **Apply** (+ Open).
- **Detail (right / push view):** artifact preview (PDF / photo / email body / voice transcript) + **Henry's extracted fields with per-field confidence** (low-confidence flagged) + **Apply** (opens the intent dialog) + Dismiss. *(OD draft-1's extracted-fields-with-confidence panel and Apply actions transfer directly — they were the right vocabulary on the wrong content model.)*

## The Apply flow (the heart of the screen)
**Apply** opens an intent dialog keyed to the artifact kind, creates the destination, and stamps the draft `applied`:
- receipt → **vendor bill** (`project_costs`) · sub-quote PDF → **sub-quote** · drawing/spec → **document** (`project_documents`) · photo → **project photo** (`photos`) · customer email → **message** · lead form → **new project** (creates customer + project).
- Each dialog: pick-or-create the **project** to attach to + the key fields, **pre-filled from Henry's extraction**. After Apply: **undo / move-to-another-project / edit**.

## Progressive disclosure
- **Snapshot:** the triage list (source · intent · summary · status · Apply).
- **Operational:** open a draft → preview + extracted fields + Apply.
- **Detail:** correct a field / change the intent / read the full transcript.
- **Audit:** "Henry classified as Receipt (92%) · applied to Smith Reno as a vendor bill" — disposition history.

## Henry intelligence (the real `ai_extraction`)
Classify the artifact → suggest the destination intent · extract structured fields **with confidence** (flag low) · match to an existing project/customer (`recognized_customer_id`) · transcribe voice memos. Labeled + editable; **the operator confirms every Apply** — no auto-apply to records.

## Todos & Work log tabs
- **Todos:** the operator's task list (`todos`/`tasks`) — quick-add, due date, optional project link. Not intake. *(Same surface also stands alone at `/todos`, linked from the dashboard command-center — one component/data, two entry points.)*
- **Work log:** chronological `worklog_entries` feed (created / applied / sent), searchable — the activity record.

## Role variations
Owner / Admin / Member (dashboard surface). **Not** a worker or homeowner surface.

## Mobile vs desktop
- **Desktop:** master–detail; batch select for multi-dismiss / multi-apply.
- **Mobile:** stacked cards → tap to preview + Apply; one-tap accept Henry's intent. Forward-by-email is the dominant capture path (no heavy mobile form).

## Financial / Canadian
Receipts/bills carry GST (`gst_cents`) → the vendor-bill Apply dialog pre-fills tax. CAD. (No holdback.)

## States
- **Empty:** "Nothing waiting on you. Forward bills, quotes, photos, or emails to henry@inbound.heyhenry.io and they'll land here." (calm, with the forward affordance).
- **Loading:** skeleton cards. **Error:** a draft in `error` disposition → "Henry couldn't read this — open to classify manually." **Offline:** cached list.

## Subscreen inventory
The intake triage queue (`intake_drafts`). The per-type **review dialogs** are the heart of it.

**Modals / dialogs (review-and-file, one per draft type)**
- **Staged bill** (`staged-bill-confirm-dialog`) — review a Henry-extracted vendor bill → confirm into a project **cost** (category, GST) / PO.
- **Staged document** (`staged-document-dialog`) — file an inbound doc to a project.
- **Staged photo** (`staged-photo-dialog`) — file a photo to a project gallery (+ tag).
- **Staged message** (`staged-message-dialog`) — route an inbound message into a project thread.
- **Add-note** (`add-note-dialog`) + **Todo form** (`todo-form`) — capture a note/todo from a draft.

**Sub-flows**
- **Classify → review → file/convert** — Henry classifies each `intake_draft` by type; the operator reviews (the dialogs above) and files to the right object. Capture-now / clean-up-later; never blocks capture.
- **Web-share capture (`/share`)** — the PWA Share-Target landing: the operator shares a file/photo from the OS share sheet → a project-picker page → forwards into Intake with `?share=` (pre-stages the shared file). This is where the "web share" source originates. Thin picker; no separate brief.

**Inline / transient / view-state**
- **Tabs** — Intake · Todos · Work log (open Q: split Work log to a global surface); per-type badge; per-type empty states.

**No graduate** — the review dialogs are the subscreens; their targets (cost / photo / message / doc) live on their own screens.

## Open questions
1. Keep Intake / Todos / Work log as three tabs, or split Work log into a global activity surface? (Current: 3 tabs.)
2. Batch-apply for same-kind drafts (a stack of receipts → one project)?
3. Relative prominence of the "forward to henry@inbound" affordance vs. an in-app drop-zone?
