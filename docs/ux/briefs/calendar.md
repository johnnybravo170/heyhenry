# OD Brief — Calendar (the crew-labour scheduling surface)

> **Grounded in:** `src/app/(dashboard)/calendar/page.tsx` (route, `?view=` + `?ym=` params, month/two-week window math), `src/components/features/calendar/owner-calendar.tsx` (the two existing pivots, drag-to-move, skip-weekends, `AssignWorkersDialog`), `src/components/features/calendar/assign-workers-dialog.tsx`, `src/lib/db/queries/owner-calendar.ts` (`getOwnerCalendarData` → assignments + workers + projects + unavailability + a **logged-time map** `${worker}:${project}:${date}→hours`), `src/server/actions/project-assignments.ts` (`bulkAssignDatesAction`, `moveAssignmentToAction`, `moveAssignmentsAction`, `removeAssignmentAction`, `assignWorkerAction`, `updateAssignmentRatesAction`), `src/lib/db/queries/worker-unavailability.ts` (`REASON_LABELS`). Data: `project_assignments` (`scheduled_date` **NULL = roster, set = a scheduled day**; nullable `hourly_rate_cents`/`charge_rate_cents`), `worker_profiles` (`worker_type`, `default_hourly_rate_cents`, `default_charge_rate_cents`), `worker_unavailability`, `time_entries`. Migrations `0051_worker_profiles`, `0052_project_assignments`, `0054_pay_and_charge_rates`. Vault: Object Model `b4d880be`, Role Matrix `03b1ccf4`, Workflow Library `e0263cc3` (#4 Field Operations Loop, #6 Job Costing). Siblings: **`project-hub.md`** §"Crew" (the project-level roster — membership) + §"Crew scheduling — a cross-project surface (deferred)" (this brief is that surface).
> **How to use:** paste into the OD project (HeyHenry "Paper" palette), generate hi-fi desktop + mobile for the **by-worker** pivot, then run `heyhenry-design-critique`.
>
> **Single-location principle (governs this whole surface).** Crew-labour scheduling lives in **exactly one place: `/calendar`.** The new "dispatch board" need is a **third view mode** here (by-worker), NOT a new route and NOT a revived per-project grid. Everything else that touches crew either *feeds* this surface or *displays read-only from it* — nothing else edits the schedule. (This brief exists because the per-project dated grid was deleted precisely to kill that duplication.)
>
> **Current vs target:** `/calendar` is built and live with two pivots — **month** (cells = days; chips = (project, worker) assignments) and **two-week** (rows = projects × 14 days). Both write `project_assignments` via the shared actions; both show unavailability + a skip-weekends toggle. **Target (the delta):** add a **by-worker** pivot (rows = crew, columns = days) so the operator can balance *one person's* whole week across every job and catch **cross-project double-booking** — which neither current pivot makes visible, and which the DB unique index (per project+worker+date) does **not** prevent. **Flagged** where target differs from today.

**Object:** the **crew member's day** — a `project_assignments` row with a set `scheduled_date` (a body, on a site, on a date). · **Roles:** owner / admin (full); member (view); worker (own days only, read-only via `/w`); homeowner (never). · **Primary action:** put the right person on the right job for the right day, without double-booking, and keep the plan reconciled with logged labour.

## Purpose
The GC's **organize-my-crew** surface — the account-level answer to *"who's on which site this week?"* Until now crew lived only at the project level (per-job roster + a per-job grid), so you could never see one worker's whole week or catch the same person promised to two sites on Tuesday. `/calendar` lifts it up: the **crew**, not the job, becomes the thing you balance. It is operator planning chrome — no customer ever sees it.

## The three pivots (one surface, one data set)
All three render the same `project_assignments` rows and use the same assign/move/remove actions. The pivot is a **grouping/render change, not a new engine.**
- **Month** *(current)* — cells = days; chips = (project · worker). Best for "what's the shape of the month." Click a cell → `AssignWorkersDialog` prefilled to that date.
- **Two-week** *(current)* — rows = **projects** × 14 days; worker chips per cell. Best for "is this job staffed."
- **By-worker** *(TARGET — new)* — rows = **crew members** × days (7 or 14); cells = the job(s) that person is on that day. Best for "is *Mike* fully booked, free, or double-booked." This is the dispatch board.

A single **pivot toggle** (`?view=month | two-week | by-worker`) switches them — same header, nav, skip-weekends toggle, and date window. (Today's toggle is month/two-week; extend it.)

## The by-worker grid *(target — the headline screen)*
```
Crew · week of Mar 24      [‹ ›]   By: [Month] [Project] ‹By worker›   ☑ skip weekends   ✦ Assign
─────────────────────────────────────────────────────────────────────────────────────────
                 Mon 24      Tue 25       Wed 26      Thu 27      Fri 28
 Mike Reyes   Glenwood    Glenwood     ⚠ Glenwood   —            Mohan
 (employee)                            + Mohan
 Dave T (sub) Mohan        Mohan        Mohan        🏖 Vacation  🏖 Vacation
 Priya K      —            Northbeam    Northbeam    Northbeam    Northbeam
```
- **Each cell** = a job chip (project-color hash, reused from the existing calendar) per assignment that day. Empty cell = open capacity (a calm "—", not loud).
- **Conflict cell (`⚠`, danger-soft):** the same worker on **two different projects the same day** — stacked chips + a danger ring. This is the core value: it's invisible in the project-centric pivots and not blocked by the DB. Label + glyph, never colour-only.
- **Unavailable cell:** `worker_unavailability` reason chip (🏖 vacation / 🤕 WCB / sick — `REASON_LABELS`), hold-tone; assigning over it warns first.
- **Row = a worker** from `worker_profiles` (employees + subs, `worker_type` distinguishes; sub rows muted-tagged). A row-end mini-tally ("4 days booked") gives at-a-glance load.
- **Drag** a chip cell-to-cell (same worker, new day) or onto another worker's row (reassign person) → reuses `moveAssignmentToAction` / `moveAssignmentsAction`. **`✦ Assign`** opens the shared `AssignWorkersDialog` (date-range bulk-assign via `bulkAssignDatesAction`); pre-scope it to the focused worker when entered from a row.

## Progressive disclosure
- **Snapshot:** the grid itself + a one-line attention strip ("2 double-bookings this week · 1 unstaffed active job") — Henry-prompt chrome, links into the offending cells.
- **Operational:** click a cell → a popover with the assignment(s): job link, rate (inherited vs override), notes, **logged vs scheduled** (from the time-entries map already in `getOwnerCalendarData`), and Move / Remove. Click an empty cell → assign.
- **Detail:** rate override + note = the `updateAssignmentRatesAction` disclosure (same contract as the roster's per-row override — don't reinvent).
- **Audit:** assignment history isn't a V1 surface; the worklog already records crew changes.

## Henry intelligence touchpoints *(surfaces, never auto-assigns)*
- **Conflict flags** — double-booking + unavailability clashes computed deterministically (no LLM) and shown live as you drag/assign. The reject-if guard: Henry must never silently let a double-book through.
- **Load-balance nudge** — "Mike has 3 open days; Glenwood framing is behind — assign him?" One-tap to the assign dialog. Labeled `✦ HENRY`, dismissible.
- **Plan-vs-actual** — "Glenwood: 12 crew-days scheduled, 4 logged — behind pace," feeding the project Overview margin-at-risk strip (the time-entries map is already loaded here). Display/undo rules per `[[henry-intelligence-not-chat]]`.

## The edges — what touches crew but must NOT duplicate the scheduler
| Surface | Role | Edits the schedule? |
|---|---|---|
| **`/calendar`** | The one scheduler — three pivots over `project_assignments` | ✅ the only place |
| **Project Details → Crew roster** (`crew-roster.tsx`) | *Membership* (who's on this job's crew); writes `scheduled_date NULL` | ❌ feeds `/calendar` |
| **Project Schedule tab** (Gantt) | The job's *work timeline* (phases/tasks) — a different object | ❌ read-only "crew on this job this week" card → deep-links to `/calendar?view=by-worker&project=…` |
| **Worker `/w` app** | A worker's own assigned days | ❌ read-only mirror |

**Naming discipline (anti-confusion):** "**Schedule**" = the job's Gantt *work timeline*; "**Calendar**" = the crew's *days*. Two different objects; neither bleeds into the other's job.

## Role variations
- **Owner / admin:** full board — assign, move, remove, override rates, see all crew + all jobs. (`assignWorkerAction` and siblings assert owner/admin.)
- **Member:** read-only view of the board (no write); useful for a PM who coordinates but doesn't own labour cost.
- **Worker:** never sees `/calendar`; their own days mirror into the `/w` app, read-only.
- **Homeowner:** never — this is internal labour/cost-adjacent (rates, crew names); not a portal surface.

## Mobile vs desktop
*"Mobile = doing work; desktop = thinking work."* Scheduling is thinking work.
- **Desktop:** the full grid — drag, bulk date-range assign, reconcile, all three pivots.
- **Mobile:** glance **"who's where today/this week"** (by-worker, today-anchored, vertical list of crew → their job today); **quick reassign** on a sick-day (tap chip → move/remove); approve a Henry conflict fix. Bulk multi-day drag is a desktop affordance — don't force it on a phone. ≥44px cells/chips.

## Financial / Canadian
No customer money on this surface, but **labour rates** flow from here: each scheduled day carries the worker's pay/charge rate — **inherited from `worker_profiles` defaults**, with a nullable per-assignment override (the variance RPC `COALESCE`s to the default). Rates render via `Money` (tabular, de-emph cents), CAD. Subs vs employees tagged by `worker_type`. No GST on this surface (labour costing handles tax downstream). **No holdback.**

## States
- **Empty (no crew):** icon + "No crew yet" + line + CTA → `/settings/team` to invite a worker (mirror the roster's empty state).
- **Empty (crew, nothing scheduled):** the grid renders with all-open rows + a calm "Nothing scheduled this week — drag a crew member onto a job, or ✦ Assign."
- **Loading:** per-grid skeleton (reuse the calendar's existing skeleton rhythm).
- **Error:** non-fatal — assignment writes use the `{ ok, error }` shape + toast; a failed move snaps the chip back (optimistic-then-revert).
- **Offline:** desktop planning surface — not offline-first; sends require connection (queue/disable, don't silently drop).

## Subscreen inventory
The crew-scheduling board. Subscreens spec inline; the three pivots are view-state, not separate screens.

**Modals / dialogs / popovers**
- **Assign-workers dialog** (`assign-workers-dialog`) — bulk date-range assign workers to a project (`bulkAssignDatesAction`); pre-scoped to a worker when entered from a by-worker row.
- **Cell popover** — the assignment(s) on a day: job link · rate (inherited vs override) · notes · **logged-vs-scheduled** (from the time-entries map) · Move / Remove.
- **Rate-override** disclosure (`updateAssignmentRatesAction`) — pay/charge override + note; same contract as the roster.

**Sub-flows**
- **Drag** a chip — cell-to-cell (same worker, new day) or onto another worker's row (reassign) → `moveAssignmentToAction` / `moveAssignmentsAction`; optimistic-then-revert on failure.

**Expansion / disclosure / view-state**
- **Pivot toggle** — `?view=month | two-week | by-worker`; same data + actions, grouping changes. Row-end "N days booked" tally.

**Inline / transient**
- **Conflict cell** — same worker on two projects a day → stacked chips + danger ring + glyph (the board's core value). **Unavailability** chip (🏖 vacation / 🤕 WCB / sick). **Skip-weekends** toggle.

**No graduate** — the by-worker board IS the headline screen (`calendar.md`); these are its in-surface subscreens.

## Accessibility
WCAG 2.2 AA: conflict + unavailability never colour-only (glyph + label); project-color chips carry text, not just hue; the pivot toggle, drag targets, and cell popovers are keyboard-operable; grid is a real table semantically (row = worker, header = day); ≥44px touch targets on mobile; focus rings on cells/chips.

## Decisions (resolved 2026-05-22)
1. **Pivot toggle** — a single **3-way** `?view=` toggle: `[Month] [Project] [By worker]`. Extends today's 2-way; no separate controls.
2. **Capacity granularity** — **day-granular** for V1 (a worker is "on" a job that day). Logged hours show in the cell popover only. Hour/day splits can be added later if requested — don't build the timesheet now.
3. **Subs** — **scheduled here too.** Employees + subcontractors both appear; sub rows are visually distinct (`worker_type` → muted "sub" tag). A sub on a site is still a body to track + double-booking to avoid.
4. **Project Schedule-tab "crew slice"** — **read-only + deep-link** into `/calendar?view=by-worker&project=…`. No write-back from the project (that would re-introduce the duplication this surface exists to kill).
5. **Member access** — **read-only** board for members (a coordinating PM sees it, can't write labour). Owner/admin write.
6. **Worker notification on (re)assignment** — **no push for V1.** The worker sees their days via the `/w` in-app mirror only. Revisit SMS/portal notify later if it's a real pain.
