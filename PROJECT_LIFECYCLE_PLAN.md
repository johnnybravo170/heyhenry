# Project Lifecycle Unification

Kanban card: `8190d7f2`.

## Problem

A project today has **two status columns that disagree**:

| Column | Values | Writer(s) |
| --- | --- | --- |
| `projects.status` | `planning`, `in_progress`, `complete`, `cancelled` | `updateProjectStatusAction`, `updateProjectAction`, DB default on insert |
| `projects.estimate_status` | `draft`, `pending_approval`, `approved`, `declined` | `sendEstimateAction`, `resetEstimateAction`, `approveEstimateAction`, `declineEstimateAction` |

Neither column alone tells you where the project is. A real project with an approved estimate and an approved change order was sitting at `status = 'planning'` until today's tactical patch (commit `0adc950`) which bumps `status` → `in_progress` on estimate approval. That patch papered over the bug; it didn't fix the data model.

Symptoms we've hit:

- Estimate approved, change order approved, but the **status badge still says "Planning"** because `status` was never moved off its insert default.
- "Awaiting approval" tab filters on `estimate_status = 'pending_approval'`, but "Active" tab filters on `status IN (planning, in_progress)`. A planning-stage project with an unsent estimate shows up under **both** Active and (eventually) Awaiting Approval, which is confusing.
- There's no terminal "estimate declined" visual state. The project just stays `planning` forever.
- `projects.phase` exists as free text (migration `0031`) but nothing writes to it in practice — it's a vestigial field from the renovation-phase R1 spike.

## Inventory: every status column on the project lifecycle

Columns that gate **project-level** dashboard filters:

1. `projects.status` — lifecycle (planning → in_progress → complete / cancelled)
2. `projects.estimate_status` — estimate sub-state (draft → pending_approval → approved / declined)
3. `projects.phase` — free text, unused
4. `projects.estimate_sent_at` / `estimate_approved_at` / `estimate_declined_at` — timestamps, derived

Adjacent status columns (scoped to their own resources, out of scope for unification but noted for context):

- `quotes.status` (standalone quotes, pre-project): draft, sent, accepted, rejected, expired
- `change_orders.status`: draft, pending_approval, approved, declined, voided
- `project_sub_quotes.status`: pending_review, accepted, rejected, expired, superseded
- `purchase_orders.status`: draft, sent, acknowledged, received, closed
- `project_bills.status`: pending, approved, paid
- `invoices.status`: draft, sent, paid, void
- `worker_invoices.status`: draft, submitted, approved, rejected, paid
- `jobs.status`: booked, in_progress, complete, cancelled
- `project_memos.status`: pending, transcribing, extracting, ready, failed

These stay. They describe *their* resource, not the project.

## Writers (today)

| Action | Writes |
| --- | --- |
| `createProjectAction` | `status = 'planning'` (default), no `estimate_status` (defaults to `'draft'`) |
| `sendEstimateAction` | `estimate_status = 'pending_approval'`, sets `estimate_sent_at`, generates approval code |
| `resetEstimateAction` | `estimate_status = 'draft'`, clears all estimate_* timestamps |
| `approveEstimateAction` | `estimate_status = 'approved'` + **today's patch**: bumps `status` → `'in_progress'` iff it was `'planning'` |
| `declineEstimateAction` | `estimate_status = 'declined'` |
| `updateProjectStatusAction` | `status` only (manual operator change) |
| `updateProjectAction` | `status`, `phase`, `percent_complete`, etc. |

## Readers (today)

| Reader | Filters on |
| --- | --- |
| `/projects` tab "All" | nothing (all rows) |
| `/projects` tab "Awaiting approval" | `estimate_status = 'pending_approval'` via `getProjectsAwaitingApproval` |
| `/projects` tab "Active" | `status IN ('planning', 'in_progress')` |
| `/projects` tab "Complete" | `status = 'complete'` |
| Dashboard "Active projects" metric (`getPipelineMetrics`) | `status IN ('planning', 'in_progress')` |
| Dashboard "Awaiting approval" card | `getProjectsAwaitingApproval` |
| Project detail header badge | `projects.status` (via `ProjectStatusBadge`) |
| Worker calendar / owner calendar | `projects.status` passed through raw |
| AI tool exposure (`src/lib/ai/tools/projects.ts`) | both |

## Proposed design

**One authoritative lifecycle column. Estimate sub-state stays.**

Not a merge — a layering. `status` becomes the headline stage ("where is this project in its life?"). `estimate_status` remains the sub-state for *how the estimate is doing* within the pre-work stages, but it no longer overlaps with lifecycle.

### New column: `projects.lifecycle_stage`

DB column name: `lifecycle_stage` (unambiguous, greppable).
UI label everywhere the operator sees it: **"Status"** (familiar). This is purely a rename at the DB layer; the product language doesn't change.

```
planning          -- operator building the estimate
awaiting_approval -- estimate sent, waiting on customer
active            -- approved, work happening
on_hold           -- paused, will resume (e.g. spring thaw)
declined          -- customer said no; revivable via explicit "Revise estimate"
complete          -- finished
cancelled         -- killed by operator; terminal
```

Rationale:
- `awaiting_approval` becomes a first-class lifecycle stage instead of a filter applied on top of `status='planning' AND estimate_status='pending_approval'`. Dashboard queries become trivially `WHERE lifecycle_stage = 'awaiting_approval'`.
- `active` replaces `in_progress` to match customer-facing language ("your active projects").
- `on_hold` handles weather / permit pauses without cluttering the active list. Stores `resumed_from_stage` so "Resume" drops it back where it was.
- `declined` is visible and **revivable via explicit action**, not auto-reset. If the customer wants changes, operator clicks "Revise estimate" → returns to `planning` with decline timestamp preserved in worklog. If the customer went cold and comes back months later, operator clones the project instead.
- `estimate_status` is retained but demoted to a **sub-status inside `planning` and `awaiting_approval`** only. Once lifecycle goes `active`, `estimate_status` stays `approved` forever (historical).

### State machine

```
         sendEstimate            approveEstimate
planning ───────────────▶ awaiting_approval ────────▶ active
   ▲                            │                       │
   │ resetEstimate (explicit)   │ declineEstimate       │ markComplete
   │                            ▼                       ▼
   └────── reviseEstimate ── declined               complete
                              (terminal unless
                               operator explicitly
                               revises)

planning / awaiting_approval / active ── putOnHold ──▶ on_hold
on_hold ── resumeProject ──▶ (resumed_from_stage)

any stage ── cancelProject ──▶ cancelled
```

Transitions are enforced in server actions. No raw status writes from forms (`updateProjectAction` stops accepting `status` — lifecycle only moves via the named transition actions).

**Decline handling specifically.** `declineEstimateAction` sets `lifecycle_stage = 'declined'` and keeps `estimate_declined_at` + `estimate_declined_reason` populated. It does **not** auto-revert. To revive, operator clicks "Revise estimate" which calls `reviseEstimateAction` → `lifecycle_stage = 'planning'`, `estimate_status = 'draft'`, decline fields preserved, worklog entry written. For cold revivals months later, the UX nudges "Clone project" instead.

**On-hold handling.** `putOnHoldAction(projectId, reason?, targetResumeDate?)` stores the current stage in `resumed_from_stage` and sets `lifecycle_stage = 'on_hold'`. `resumeProjectAction(projectId)` reads `resumed_from_stage` and restores. On-hold projects are excluded from the default Projects list (surfaced under "All" only) and from the dashboard "Active projects" count.

### Derived column or stored?

**Stored, not derived.** Reasons:

1. Index-friendly: dashboard counts and list filters are `WHERE lifecycle_stage = X`.
2. The auto-advance on approval is already a write; we're not saving query cost by computing it.
3. A computed column from `(status, estimate_status)` has ambiguous cases (what if operator manually sets status='in_progress' while estimate_status='pending_approval'?). Today that's real and silently inconsistent. Stored + enforced transitions removes the ambiguity.

### `phase` column

Drop. Nothing writes it, nobody reads it. Validator has it as optional free text; remove from schema/validator/migration. One-liner migration.

## Migration plan

**Phase 1 — data model (one migration).**
1. Add `lifecycle_stage` TEXT column with a CHECK constraint for the 7 values.
2. Add `resumed_from_stage` TEXT column (nullable) for on-hold round-trips.
3. Backfill in SQL:
   ```
   lifecycle_stage =
     CASE
       WHEN status = 'cancelled'                               THEN 'cancelled'
       WHEN status = 'complete'                                THEN 'complete'
       WHEN estimate_status = 'declined'                       THEN 'declined'
       WHEN estimate_status = 'approved'                       THEN 'active'
       WHEN estimate_status = 'pending_approval'               THEN 'awaiting_approval'
       ELSE 'planning'
     END
   ```
4. Make `lifecycle_stage` NOT NULL with default `'planning'`.
5. Drop `projects.phase` (dead column from 0031).
6. Keep `projects.status` around for one deploy cycle so reverting is cheap; drop it in Phase 3.

**Phase 2 — writers.**
- Rename `updateProjectStatusAction` → `transitionLifecycleStageAction` with a transition allow-list.
- `approveEstimateAction` / `declineEstimateAction` / `sendEstimateAction` / `resetEstimateAction` write `lifecycle_stage` alongside `estimate_status`.
- `updateProjectAction` stops accepting `status` / `phase`.
- Remove the tactical `statusPatch` in `estimate-approval.ts` (commit `0adc950`) — superseded.
- Worklog entries on every transition.

**Phase 3 — readers.**
- `/projects` tabs: All / Awaiting approval / Active / Complete filter on `lifecycle_stage` directly. "Awaiting approval" count stops needing a separate query — it's just `count WHERE lifecycle_stage = 'awaiting_approval'`.
- Dashboard `getPipelineMetrics.activeProjectCount` → `lifecycle_stage = 'active'`.
- Dashboard awaiting-approval card → `lifecycle_stage = 'awaiting_approval'`.
- `ProjectStatusBadge` takes `lifecycle_stage`; update colors (`awaiting_approval` = amber, `declined` = red).
- AI tools: expose `lifecycle_stage` only, remove `status`.
- Drop `projects.status` in the same migration.

**Phase 4 — cleanup.**
- Remove `ProjectStatus` from `src/lib/validators/project.ts`, replace with `LifecycleStage`.
- Remove `projectStatusChangeSchema` / `projectStatuses` exports.
- Delete `phase` from validator.
- Update `PATTERNS.md` §status-badge family if it references project status.

## Open questions for Jonathan

1. Naming: `lifecycle_stage` vs `stage` vs keep `status` (and rename values only). I prefer `lifecycle_stage` because grepping `status` across the repo is already noisy. Confirm or pick.
2. Should `declined` auto-revert to `planning` on `resetEstimateAction`, or stay `declined` and require an explicit "resurrect" action? I'd default to auto-revert because that's what `resetEstimateAction` already implies.
3. Do we want a visible "on hold" stage, or is `cancelled` + clone the answer when a job gets paused indefinitely? Current bias: no "on hold" — simpler.
4. Worker-facing filters (owner calendar, worker dashboard) currently show `status` raw. OK to show `lifecycle_stage` there too, or do workers want a simpler two-state (active / not active)?

## Files touched (preview)

- `supabase/migrations/0097_project_lifecycle_stage.sql` (new)
- `src/lib/validators/project.ts`
- `src/server/actions/projects.ts`
- `src/server/actions/estimate-approval.ts` (remove tactical patch)
- `src/lib/db/queries/projects.ts`
- `src/lib/db/queries/awaiting-approval.ts`
- `src/lib/db/queries/dashboard.ts`
- `src/lib/db/queries/owner-calendar.ts`
- `src/lib/db/queries/project-assignments.ts`
- `src/components/features/projects/project-status-badge.tsx`
- `src/app/(dashboard)/projects/page.tsx` (tab filters)
- `src/app/(dashboard)/projects/[id]/page.tsx`
- `src/lib/ai/tools/projects.ts`
- `PATTERNS.md`

## Not doing (explicit)

- Not touching `quotes.status`, `change_orders.status`, or any other per-resource status. Those describe their own resource, not the project.
- Not building a visual timeline / Gantt of stages. Badge + filter tabs are enough.
- Not adding transition audit table — `worklog_entries` already handles this.
