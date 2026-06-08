# OD Brief — Worker app `/w` (the field surface for employees + subcontractors)

> **Grounded in:** the worker route group `src/app/(worker)/w/*` — `page.tsx` (**Today**), `calendar/`, `tasks/`, `projects/` + `[id]/`, `time/` + `new/` + `[id]/edit/`, `expenses/` + `new/`, `invoices/` + `new/` + `[id]/`, `profile/`, `layout.tsx` (the shell). Components `src/components/features/worker/*` (`worker-bottom-nav.tsx`, `worker-time-form.tsx`/`-list`, `worker-task-list.tsx`, `worker-expense-form.tsx`/`-list`, `worker-invoice-new-form.tsx`/`-status-badge`/`-withdraw-button`, `worker-profile-form.tsx`, `unavailability-form.tsx`/`-row`) + `checklist/team-checklist.tsx` + `site-switcher.tsx` (on Today). Guard: **`requireWorker()`** (middleware redirects workers off `/dashboard` etc. → `/w`). Data: **`worker_profiles`** (`worker_type` ∈ employee | subcontractor; `display_name`/`phone`/`business_name`/`gst_number`; `default_hourly_rate_cents`; **`can_log_expenses`/`can_invoice`** overrides), **`project_assignments`** (`scheduled_date` NULL=ongoing / set=that day), **`time_entries`** (hours, rate, category, `worker_profile_id`), **`project_costs`** (worker expenses, receipt), **`worker_invoices`** (`status` ∈ draft | submitted | approved | rejected | paid; `period_start/end`; `line_items` JSONB; `rejection_reason`), `worker_unavailability`. Tenant defaults `workers_can_log_expenses` / `workers_can_invoice_default`. **Plan of record:** `GC_WORKFLOW_PLAN.md` §"Worker app / subcontractor experience" (phases **W1–W7**, owner-controls table, open questions). Vault: Object Model `b4d880be`, Role × Object Matrix `03b1ccf4` (**worker → `/w` only; can't see dashboard/contacts/financials**), Workflow Library `e0263cc3` (#4 Field Operations Loop). Siblings: **`calendar.md`** (owner crew scheduling — the source of the worker's assignments), `invoices.md` (the owner approval queue `/invoices?view=worker`), `project-secondary-tabs.md` (photo/memo capture).
> **How to use:** this is a **mobile-only** surface — render **phone-first** (the bottom-nav shell + Today + a capture flow); desktop is incidental. Generate Today, the time-entry capture, and the invoice-build flow, then run `heyhenry-design-critique` at mobile width. Note `GC_WORKFLOW_PLAN.md` predates the current schema — it says "buckets"/`jobs`/`expenses`/"homeowner"; reconcile to today's `project_budget_categories`/`projects`/`project_costs`/**client**.
>
> **Governing principle — a calm, capable phone for the jobsite.** The worker surface is the **field half** of the product ("mobile = doing work"): show today's job, log time and expenses in seconds, capture photos, and (for subs) bill — nothing else. Three rules: (1) **hide the employee/subcontractor distinction from the worker** — they just see "Time," "Invoices" (if on); `worker_type` lives only in the owner's settings; (2) **capture-now / clean-up-later, offline-tolerant** — never block a field entry on a slow network or perfect data; (3) **capability-gate the surface** — Expenses + Invoices only appear when the owner enabled them.
>
> **Current vs target:** the full W1–W7 plan is built and live — Today, Calendar, Tasks, Projects, Time, Expenses, Invoices, Profile, a bottom-nav, and a 7pm un-logged-time nudge. **Target (the deltas):** (1) **the bottom nav is overloaded** — it renders up to **8 items** (Today/Tasks/Calendar/Projects/Time + Expenses + Invoices + Profile); a phone nav wants ~4–5, so consolidate to primary + overflow; (2) **Paper-palette restyle** (raw `red-700` rejection text, plain borders today); (3) **capture ergonomics** — bigger glove/outdoor targets, camera-first expense, explicit offline state; (4) terminology — the plan/legacy copy says "bucket"/"homeowner," should be **category**/**client**. **Flagged** throughout.

**Object:** the **worker's day** — their `project_assignments` (what to do), `time_entries` + `project_costs` (what they did), and `worker_invoices` (what they're owed, subs only). · **Roles:** **worker** only (employee or subcontractor — same surface, gated by capabilities). Owner/admin never land here; client never. · **Primary action:** *open the app on site, see today's job, log my hours in two taps.*

## Purpose
The phone the tradesperson actually uses on the job. The owner's dashboard answers "is the business OK"; `/w` answers the worker's "what am I on today, and how do I record what I did." It's the capture end of the **Field Operations Loop** — the time/expense/photo data that feeds Labour, Spend, and (for subs) the worker-invoice → owner-approval → project-cost chain.

## The shell *(mobile-first; compose from `card`, bottom-nav, big touch targets)*
- **Fixed bottom-nav** (`worker-bottom-nav`, `max-w-md` centered): Today · Tasks · Calendar · Projects · Time **+** Expenses *(if `can_log_expenses`)* **+** Invoices *(if `can_invoice`)* **+** Profile. **This is the overload problem** — up to 8 tabs. *Target:* a ~4-tab primary nav (Today · Calendar · Projects · Profile per the original plan) with Time/Tasks/Expenses/Invoices reached from Today + an overflow, or a "+log" action button.
- **No desktop chrome** — full-width single column, thumb-reachable actions, safe-area padding for the fixed nav.

## The surfaces
- **Today (`/w`)** — greeting + a **profile-incomplete** prompt (name/phone/GST-for-subs) + **Today's schedule** (day-scheduled rows first, then ongoing assignments; each with a one-tap **Log time**) + a per-project **Team checklist** widget with a site-switcher. The cockpit: "what am I on, log it."
- **Calendar (`/w/calendar`)** — the worker's assigned/scheduled days (mirror of the owner crew calendar in `calendar.md`); past = what was logged, future = what's scheduled; tap a day → pre-filled time entry. **Read-only on the schedule; write on time.**
- **Tasks (`/w/tasks`)** — assigned tasks (status update on `tasks` where assigned).
- **Projects (`/w/projects` + `/[id]`)** — assigned projects only; detail shows the **scope the worker should see** (name, address, categories, notes, latest portal updates) — **never** margin/markup/customer financials/other projects.
- **Time (`/w/time` + `/new` + `/[id]/edit`)** — the core capture: history grouped by week; new entry pre-fills project + date from context; category picker limited to the project's categories; self-edit window (recommend 24h, then owner-only — plan open Q5).
- **Expenses (`/w/expenses` + `/new`)** *(gated `can_log_expenses`)* — **camera-first** receipt capture → amount + project + vendor → `project_costs`; owner sees it on Spend.
- **Invoices (`/w/invoices` + `/new` + `/[id]`)** *(gated `can_invoice`)* — the **sub-billing queue**: build from unbilled time+expenses (period or checkboxes) → auto-subtotal + GST → draft → **submit**; status badge (draft/submitted/approved/rejected/paid), rejection reason inline, **withdraw** while submitted.
- **Profile (`/w/profile`)** — display name, phone, business name + **GST number** (subs), default rate, nudge prefs, and **unavailability** (vacation/sick → feeds the crew calendar's conflict flags in `calendar.md`).

## Progressive disclosure
- **Snapshot:** Today — today's job + log-time.
- **Operational:** log time/expense, update a task, build/submit an invoice.
- **Detail:** a project's scoped view; a time entry's edit; an invoice's line items.
- **Audit:** the worker sees their own history (time list, invoice statuses); the full audit is the owner's.

## Henry intelligence touchpoints *(accelerate capture; never auto-submit money)*
- **Voice → time/memo** — a voice memo on site → transcript → suggested time/notes (the capture-now loop; `project_memos`). Henry drafts, worker confirms.
- **Receipt OCR** — snap a receipt → Henry extracts amount/vendor/category, worker confirms (never auto-posts an expense).
- **Invoice from logged work** — the "build from unbilled time+expenses" step is the leverage: Henry assembles the draft; the worker reviews + submits (human-in-the-loop; never auto-submitted to the owner).
- **7pm nudge (W7)** — workers with a scheduled day + no time logged get an email/SMS reminder. Surface gently; respect `nudge_email`/`nudge_sms` prefs.

## The edges — `/w` writes; the owner reviews
| Surface | Relationship |
|---|---|
| **Owner crew tab / `calendar.md`** | Where assignments + day-scheduling are *created*; `/w` is the read + capture mirror |
| **Owner Labour/Spend tabs** | Worker time/expenses surface there tagged by worker |
| **Owner approval queue** (`/invoices?view=worker`, `invoices.md`) | Where submitted `worker_invoices` are approved/rejected/paid; approval can roll into `project_costs` (plan open Q4) |
| **Dashboard / Contacts / Financials** | **Hard boundary** — workers never see these (middleware redirect + RLS) |

## Role variations
- **Employee worker:** Today/Tasks/Calendar/Projects/Time/Profile; Expenses if enabled; **no invoicing** by default.
- **Subcontractor worker:** same surface **+ Invoices** (default on for subs) + GST/business fields on profile. *The worker never sees the word "subcontractor" — it's an owner setting.*
- **Owner/admin/member:** never land on `/w` (redirected to dashboard).
- **Client:** never — no overlap with the portal.

## Mobile vs desktop
**Mobile is the whole story.** Design for one-handed, outdoors, gloves, spotty signal: ≥44px (lean bigger) targets, camera-first capture, minimal typing (pickers + steppers over keyboards), bottom-anchored primary actions. Desktop is a fallback, not a design target.

## Financial / Canadian
- **Worker GST:** subs carry a `gst_number`; their invoices compute **GST** (the worker is a Canadian vendor billing the GC). CAD, cents.
- **Worker invoice ≠ customer invoice** — it's the sub→GC bill (`worker_invoices`), distinct from the customer-facing `invoices`. On approval it can become a `project_cost` (real labour cost, no double-entry — plan Q4).
- **Payouts** are out of the app today (owner pays the sub outside HeyHenry); e-Transfer/cheque tracking could surface later. **No holdback** (BC 10% holdback skipped per plan).

## States
- **Empty:** Today with no schedule — "No projects scheduled today; you can still log time against any project you're on" (built). Invoices empty — "bill unreviewed time & expenses."
- **Loading:** lightweight skeletons; Today is `force-dynamic`.
- **Error:** writes use `{ ok, error }` + toast; a rejected invoice shows its reason inline.
- **Offline (critical):** time/expense/photo capture must **queue offline and sync** with an explicit "saved, will sync" state — this is a jobsite app; never silently drop a field entry. Invoice submit requires connection (queue + clear state).

## Subscreen inventory
- **Time entry new/edit** (`/w/time/new`, `/[id]/edit`) — **HEAVY → own render.** Pre-filled project/date/category; the #1 capture flow. 24h self-edit window.
- **Expense capture** (`/w/expenses/new`) — **HEAVY → own render.** Camera → receipt → amount/vendor/project. Gated.
- **Invoice build + submit** (`/w/invoices/new`, `/[id]`) — **HEAVY → own render.** Select unbilled time/expenses → totals+GST → draft → submit/withdraw. Gated.
- **Today's Team checklist** (`team-checklist` + `site-switcher`) — **MEDIUM → inline.** Shared per-project checklist with a project switcher.
- **Calendar day view** — **MEDIUM.** Tap day → scheduled projects + log-time shortcut.
- **Profile + unavailability** (`/w/profile`) — **MEDIUM → inline.** Identity/GST/nudge prefs + vacation/sick rows (feed crew-calendar conflicts).
- **Project detail (scoped)** (`/w/projects/[id]`) — **MEDIUM.** The worker-safe project view.

## Accessibility
WCAG 2.2 AA, **field-hardened**: ≥44px (prefer larger) targets for gloves; high outdoor contrast (don't rely on subtle Paper tints alone); status badges label+glyph not colour-only; the bottom-nav is a real labeled nav with clear active state; camera/upload have non-camera fallbacks; forms minimize typing (pickers/steppers); focus + safe-area handling around the fixed bottom nav.

## Decisions / Open questions
1. **Bottom-nav overload (the headline UX fix)** — up to 8 tabs. *Recommendation:* 4 primary (Today · Calendar · Projects · Profile) + a prominent "Log" action; Tasks/Time/Expenses/Invoices reached from Today/overflow. Confirm the primary set with OD.
2. **From `GC_WORKFLOW_PLAN.md` open questions (still live):** SMS nudges (is Twilio paid? else email-only) · multi-tenant workers (out of scope v1) · **hide "subcontractor" from worker copy** (decided: yes) · approved worker-invoice → auto-create `project_cost` tagged `source='worker_invoice'` (recommended) · time-entry self-edit window (recommend 24h).
3. **Terminology** — retire "bucket" → **category**; "homeowner" → **client** (worker rarely sees the client, but copy must be consistent: `[[feedback_no_bucket_terminology]]`, `[[feedback_client_not_homeowner]]`).
4. **Worker is the surface most divorced from the Paper redesign** — confirm it's in scope for the restyle pass (it's high-frequency, low-glamour, easy to skip).
