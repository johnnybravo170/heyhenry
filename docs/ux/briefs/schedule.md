# OD Brief — Project ▸ Schedule (the job's work timeline)

> **Grounded in (read these before prompting):**
> - **Route / shell:** `src/app/(dashboard)/projects/[id]/page.tsx` (tab key `schedule`, label "Schedule"; **primary** nav `Budget · Spend · Labour · Schedule · Billing · Overview`) → `tabs/schedule-tab-server.tsx` (parallel RSC loads: tasks, `project_type_templates`, `project_phases`, `trade_templates.typical_phase`, `project_schedule_dependencies`, `projects.start_date` + `schedule_notify_*`).
> - **Operator UI:** `schedule-interactive.tsx` (client boundary — optimistic drag, toolbar, notify-Undo), `schedule-gantt.tsx` (CSS-grid autoscale Gantt, phase-grouped, drag-move + edge-resize, custom tooltip, sticky-left name column), `schedule-bootstrap-panel.tsx` (3-choice empty state), `schedule-task-editor.tsx` (create/edit modal + "Depends on" picker), `schedule-regenerate-deps-button.tsx`, `schedule-clear-button.tsx`, `project-start-date-editor.tsx`.
> - **Data / actions:** `src/server/actions/project-schedule.ts` (`bootstrapProjectScheduleAction` `{template|budget|blank}`, `updateScheduleTaskAction` → `cascadeForwardFromTask`, `createScheduleTaskAction`, `deleteScheduleTaskAction`, `setTaskPredecessorsAction`, `regenerateScheduleDependenciesAction`, `cancelScheduleNotifyAction`), `src/lib/db/queries/project-schedule.ts`, `src/lib/ai/phase-classifier.ts`, `src/lib/ui/gantt-phase-colors.ts`, migrations `0206` (tasks; `status ∈ planned|scheduled|in_progress|done`, `confidence ∈ rough|firm`, `planned_duration_days`), `0211` (notify triple), `0213` (`project_schedule_dependencies`, finish-to-start + `lag_days`), `0122` (seeds the 10 canonical phases).
> - **Customer side:** `portal-schedule-gantt.tsx` (read-only, **firm bars only**, high-disruption amber "plan to be out" warning).
> - **Henry voice tools (exist, off-screen):** `src/lib/ai/tools/schedule-tasks.ts` — `list_schedule_tasks`, `update_schedule_task` (date/duration edits cascade). `regenerate_schedule_dependencies` was **removed** as a tool (too destructive for voice) → it's the button.
> - **Crew lives elsewhere (do NOT pull it onto this tab):** crew scheduling is single-homed at **`/calendar`** — `src/app/(dashboard)/calendar/page.tsx`, `calendar/owner-calendar.tsx` (month / two-week / **by-worker** pivots, drag-to-move, **skip-weekends toggle**), spec'd in **`docs/ux/briefs/calendar.md`**. The old per-project crew grid (`crew-schedule-grid.tsx`, `crew-tab-server.tsx`) was **deleted (#269)** precisely to kill that duplication. Schedule gets only a **read-only "crew this week" card** that deep-links into `/calendar` (see Layout §6).
> - **Vault (current-state, evergreen):** `Module: Project Schedule (Gantt v0 → v2)` `99ebd24f` · `Module: Customer Portal` `c3e78671`. Foundation: Positioning `5bfa59be`, Object Model `b4d880be`, Workflow Library `e0263cc3`, Role × Object Matrix `03b1ccf4`, IA/Nav `6529e9ae`. Design system: `DESIGN.md`, `DESIGN-NOTES.md`, `PATTERNS.md` (§3 confirm dialogs, §5 action result, §6 empty states, §7 status badges, §8 schedule grids, §9 tabs, §23 tenant-tz dates), `src/lib/ui/status-tokens.ts`.
> - **Siblings:** `calendar.md` (crew days — the naming counterpart), `project-hub.md` (the shell + alert model; its Schedule references were reconciled to this brief), `change-order.md` (the unlinked-CO gap below).
>
> **How to use:** paste into OD (HeyHenry "Paper" palette + DESIGN.md clarity discipline), generate hi-fi desktop + mobile, then run `heyhenry-design-critique`. Feeds Dev cards on the Ops `dev` board, tag `epic:ux-redesign`.
>
> **⚠ Stale-doc correction (code wins):** `schedule-tab-server.tsx`'s header comment still says **"v0 read-only."** That is obsolete. The shipped tab is **v2**: drag-to-reschedule, edge-resize, click-to-edit, custom-task add, predecessor edges with **forward-only auto-cascade**, a "Depends on" picker, deterministic phase classifier, and Henry voice tools. This brief specs the **v2 surface**. (`project-hub.md` carried the same stale "v0 read-only / crew-day slice" line — now reconciled to match this brief and `calendar.md`.)

**Object / workflow / role(s):** primary = the **Project's work timeline** (`project_schedule_tasks` grouped by `project_phases`, linked by `project_schedule_dependencies`); workflow = **Job Activation → Field Operations Loop** (Workflow Library #3/#4) — *plan the trade sequence, keep it true as reality slips, communicate firm dates to the customer*. Roles: **owner / admin / member** (full edit); **homeowner** (portal, firm read-only); **worker** (not here — see Role variations). **Primary action:** *keep the timeline honest — bump what slipped, lock what's firm, tell the customer — without hand-editing every downstream date.*

## Naming discipline (carry this through the whole design — anti-confusion)
- **"Schedule"** = the **job's work timeline** (phases → tasks → dates → dependencies). The Gantt. **This tab.**
- **"Calendar"** = the **crew's days** (who's on which site which day — `project_assignments`). The dispatch board at `/calendar`. **Not this tab.**
- Two different objects; neither bleeds into the other's job. The Schedule tab references crew only through a **read-only card → `/calendar`**. (Mirrors `calendar.md` decision #4; the per-project crew grid was deleted to enforce it.)

## Purpose
The job's **timeline**: phases → tasks, each a start + a **working-day** duration, sequenced by finish-to-start dependencies, anchored to `project.start_date`. Three jobs across the life of a project:
1. **Stand up a believable schedule fast** (early) — sequence trades, share a plan with the customer.
2. **Keep it current as reality slips** (the long middle) — drag a date and downstream tasks cascade; mark work done; lock dates as they firm.
3. **Communicate firm dates to the homeowner** (continuous) — the portal shows firm bars + "plan to be out" disruption warnings; changes notify the customer (deferred, undoable).

It is **not** a CPM/critical-path tool, **not** crew dispatch (that's `/calendar`), **not** the labour-hours ledger (that's **Labour** = actuals). It's the **plan**; Labour is the **actuals**; Calendar is the **bodies**.

## Current vs target (the delta this brief drives)
The v2 Gantt is capable but reads as a **planning artifact, not an operating surface**, and it has **zero embedded Henry** (the AI bootstrap was deliberately removed in favour of the deterministic classifier — vault `99ebd24f`). Five gaps:
1. **Durations count weekends.** `planned_duration_days` is applied as **raw calendar days**, so "8 days of electrical" starting Thursday burns two weekends and lands ~12 days out — wrong for a crew that works Mon–Fri. Target: **working-day durations that skip weekends by default** (see §Working days). *(This is the user's headline ask.)*
2. **No "now" lens.** The whole tab is a full-project Gantt; the only "today" cue is a faint amber gridline. A GC mid-job opens this to answer *"what's on site this week, what's running late"* — and that read doesn't exist.
3. **No slip awareness.** A task whose planned window is in the past but isn't `done` is *behind* — nothing flags it, and nothing feeds the Overview "Needs You" strip (which `project-hub.md` says should carry "schedule slip"). *(User: "we need slip detection and all that stuff.")*
4. **The cascade is invisible.** `cascadeForwardFromTask` shifts successors **silently** — drag Drywall +3 days, four downstream bars move with no summary, no review/undo, no customer-notify framing. The biggest **Henry-leverage** miss.
5. **Off-brand chrome + a foot-gun.** Native `confirm()`/`alert()` in three places (clear, auto-link, drag-fail); "Auto-link dependencies" sits in the toolbar at equal weight to "+ Add task" yet **wipes manual edges**.

**Target:** a Schedule tab on **working-day math**, that opens on a **This-week operating digest**, surfaces **slip** (and feeds it up to Overview), makes the **cascade a visible, undoable, customer-aware Henry moment**, demotes the destructive reset, and shows a **read-only crew-this-week card → `/calendar`** — all restyled to Paper. Flagged inline where target ≠ current.

## The data truth this screen must reflect
- **Anchor:** `project.start_date` (null → today). Inline-editable on-tab (`project-start-date-editor.tsx`) — keep; it's the timeline's zero point.
- **Task:** `name`, `planned_start_date`, `planned_duration_days` (**reinterpret as working days — see §Working days**), `phase_id` (→ `project_phases`), `trade_template_id` (nullable), `status ∈ planned|scheduled|in_progress|done`, `confidence ∈ rough|firm`, `client_visible` (bool), `notes`, `display_order`. Soft-delete via `deleted_at`.
- **Dependencies:** `project_schedule_dependencies` — finish-to-start edges + `lag_days` (start_to_start / finish_to_finish exist in the column but aren't wired). **Cascade is forward-only** (pulling a task earlier never pulls successors earlier — GCs may have firmed downstream dates). Cycle-checked in the action layer.
- **Phase taxonomy (10, seeded mig 0122 + `gantt-phase-colors.ts`):** Planning & Selections · Demo · Framing · Rough-in · Inspection · Drywall · Cabinets & Fixtures · Finishes · Punch List · Final Walkthrough. Firm = solid phase color, rough = dashed/tinted; custom names fall to neutral primary.
- **Confidence = the customer-communication lever.** The portal renders **firm bars only**; `rough` is the operator's internal draft. "Locking dates" = rough→firm = *promising the customer*.
- **Notify is a deferred, debounced, undoable cron** (mig 0211, 5-min): tenant opt-in (`notify_customer_on_schedule_change`, default OFF) **AND** per-task `client_visible`. A breadcrumb always lands in the portal Updates feed regardless of the SMS/email toggle.
- **Bootstrap is deterministic** (classifier + serial layout). `generateAiBootstrap()` is dead code kept for a possible v3 within-phase-parallelism pass — **don't resurrect it in the design.**
- **Gotcha — Change Orders are NOT linked to the Gantt** (vault `99ebd24f` #13): an approved CO that adds scope does **not** add a task. Today the GC adds tasks by hand. (Target opportunity below.)

## Working days & weekends *(target — the headline change)*
Trades work Monday–Friday; the schedule must too, by default.
- **Duration is in working days.** A task's end date = start + N **working days**, skipping Sat/Sun. "8 days of electrical" starting Thu → Thu, Fri, (skip Sat/Sun), Mon–Fri, Mon = ends the following Monday — not 8 calendar days out. The editor field reads **"Duration (working days)"**.
- **The bar renders continuously across weekends** (don't fragment it into segments — that reads as "stopped then restarted"), but **weekend columns inside a bar are visually receded** (the existing weekend band shows *through* a slightly de-saturated bar segment) so the eye sees "this spans a weekend but no work happens then." The day-count math excludes those columns. *(Flag the alternative — a broken/segmented bar — as a rejected option unless critique disagrees.)*
- **Cascade respects working days.** A successor lands on the next **working day** after its predecessor's working-day end + `lag_days` (lag also counted in working days). `cascadeForwardFromTask` + `layoutTasksSerial` must switch from calendar to working-day arithmetic.
- **Per-tenant default + per-task override.** Default = skip weekends (most reno trades). Some work *does* run weekends (concrete pours, the GC's own crew pushing a deadline) → a **"works weekends"** toggle on the task (and a tenant default in Settings), mirroring the **skip-weekends toggle already shipped on `/calendar`** (`owner-calendar.tsx`) — reuse that mental model and, ideally, a shared working-day helper.
- **Holidays:** out of scope for v1 (weekends only). Note as a later enhancement; don't build a holiday calendar now.
- **Build note (migration):** existing `planned_duration_days` values were authored as calendar days. Reinterpreting them as working days will shift end dates on existing schedules. Decide at build time: a one-time "your durations are now working-days" banner + recompute, vs. a `duration_basis` column defaulting old rows to `calendar`. Lean toward **recompute with a notice** (most schedules are rough drafts) — flagged in Open questions.

## Workflow (state machine the screen serves)
```
No schedule ──bootstrap{template|budget|blank}──▶ Draft (rough)
   Draft ──drag / resize / add / set "Depends on"──▶ Draft (cascades forward, working-day aware)
   Draft ──lock dates (rough→firm)──▶ Firm  ──(customer sees firm bars; notify queued, 5-min Undo)
   Firm  ──reality slips: drag a firm task──▶ cascade ▶ Henry: "3 tasks moved · finish Apr 2→Apr 8 · notify?"
   any   ──mark task done──▶ progress; planned-end < today & ≠ done ──▶ BEHIND (feeds Overview "Needs You")
```
- **Decision points:** rough vs firm (internal draft vs customer promise); client-visible vs internal; auto-link defaults vs manual "Depends on"; works-weekends vs skip.
- **Failure modes the UI must handle:** silent cascade (→ make it visible); accidental Clear / Auto-link wipe (→ AlertDialog + demote); a slipped task nobody noticed (→ behind state + alert); customer notified about a still-rough date (→ notify gated on firm + client_visible; preview); weekend work miscounted (→ working-day math).
- **Approval / external:** the only outbound is the customer schedule-update notify — **deferred + Undo + human-in-the-loop**; never auto-send (Workflow Library locked convention).
- **Success signal:** the finish date is trustworthy, the customer isn't surprised, and the GC didn't hand-edit ten dates to move one.

## Layout (regions → real primitives)
Desktop, top to bottom. Compose existing primitives; **no new chart engine** — extend `schedule-gantt.tsx`.

**1 · Anchor + This-week digest (target — the missing "now" lens).**
- Keep `ProjectStartDateEditor` (quiet, muted, left).
- Add a **This-week digest**: a compact, one-line-per-item read of *active now · starts this week · finishes this week · **behind*** (planned-end < today & status≠done), the behind group in `status-tokens` danger-soft with a glyph. Built from the already-loaded tasks — no new query. Calm empty: *"On track — finishes May 30."* On **mobile this digest is the default view** (Gantt behind a toggle).
- A tiny **firm / rough / behind legend** so the bar vocabulary is legible.

**2 · Toolbar (rebalanced — one primary, demote the foot-gun).**
- Left: task count + interaction hint (keep the desktop/mobile copy split).
- Right: **`+ Add task`** (the one outline primary) · **`⋯` overflow** holding **Clear & start over** and **Auto-link dependencies** — both destructive/global, each behind a real shadcn `AlertDialog` (PATTERNS §3), errors via `toast` (§5), replacing today's native `confirm()`/`alert()`. "Auto-link" also appears *inline, non-destructively* in the empty-deps case ("No dependencies yet — link them automatically?").

**3 · Notify strip (keep, restyle).** The "Customer email queued · Undo" banner stays (transient, single, contextual — compatible with the "no stacked banners" rule), but move raw `amber-50/200/900` onto a `status-tokens` soft pair, and let Henry author the copy (Henry §1).

**4 · The Gantt (keep the engine, layer meaning + working-days).** Phase-grouped rows, sticky-left name column, autoscale grid, weekend bands / Monday rules / today marker, custom tooltip — all keep. Layer on:
- **Working-day bars** (§Working days): continuous bars whose weekend columns recede; tooltip shows *"5 working days · Thu Mar 26 → Wed Apr 1."*
- **Bar-state vocabulary:** done (emerald + strike — keep) · **in_progress** *(target: a distinct "active" treatment — `status=in_progress` exists but is unrendered today)* · firm (solid phase color) · rough (dashed). **Behind** = a danger-soft outline + glyph on any task past due & not done (never colour-only).
- **Per-bar quick actions** (hover desktop / long-press mobile, target): **Mark done** and **Lock dates** (rough→firm) without opening the modal — the two highest-frequency edits shouldn't cost a dialog.
- Keep the `(internal)` marker on non-client-visible tasks; make it a real `status-tokens` neutral chip, not grey parenthetical text.

**5 · Task editor modal (keep, tighten).** Name · start · **duration (working days)** · status · confidence · client-visible · notes · "Depends on". Refinements: (a) reframe **Confidence** as **"Lock dates / share with customer"** (rough = draft, firm = customer sees it) so the lever reads as intent, not jargon; (b) add the **"works weekends"** toggle; (c) **group the "Depends on" picker by phase** past ~15 tasks; (d) replace the native `confirm()` delete with the §3 AlertDialog.

**6 · Crew-this-week card (target — read-only, deep-links to Calendar).** A small, read-only card: *"Crew this week: Mike (Mon–Wed), Dave-sub (Mon–Fri)"* from `project_assignments` filtered to this project + the current week, with **"Manage in Calendar →"** linking to `/calendar?view=by-worker&project=…`. **No editing here** — scheduling crew is `/calendar`'s job (`calendar.md` decision #4). This is the only crew presence on the Schedule tab, and it answers "who's actually on this job while the timeline says X is happening" without duplicating the dispatch board.

## Slip detection (elevated — its own through-line)
A first-class concern, surfaced in four coordinated places (one signal, not four banners):
1. **This-week digest** leads with the **behind** count when > 0 (danger-soft).
2. **Gantt bars** for past-due, not-done tasks get the **behind** outline + glyph.
3. **Henry slip prompt** (§2 below) offers the one-tap fix.
4. **Overview "Needs You" strip** receives a "schedule slip" row + the **Schedule tab-label badge** carries the count — so the GC sees it from any tab (`project-hub.md` alert model). Keep the three counts consistent.
*Definition:* a task is **behind** when `planned_end (working-day) < today AND status ≠ done`. `in_progress` past its end is "running long"; `planned`/`scheduled` past its start is "not started." Treat both as slip for v1; nuance later.

## Progressive disclosure
- **Snapshot:** the This-week digest + finish date + behind count (the operating read).
- **Operational:** the Gantt — drag, resize, mark-done, lock-dates; the toolbar; the crew-this-week card.
- **Detail:** the task editor (status / confidence / works-weekends / notes / dependencies).
- **Audit:** the portal Updates breadcrumb feed ("Schedule updated"); the notify Undo window; soft-deleted tasks are recoverable (no restore UI today — fine for v1, noted).

## Henry intelligence touchpoints (currently **zero embedded** — the core opportunity)
Henry is the intelligence behind the feature, **not a chat box** ([[henry-intelligence-not-chat]]). Every output labeled `✦` and undoable; nothing auto-sends to the customer.
1. **Cascade explainer + notify (the headline).** When a drag/resize cascades, Henry summarizes the ripple inline — *"✦ Moving Drywall +3 working days pushed Finishes, Punch List & Final Walkthrough. New finish: Apr 2 → Apr 8."* — with **Undo** and, when the moved tasks are firm + client-visible, **Notify customer** (routes into the existing deferred-notify + Undo). Turns the silent `cascadeForwardFromTask` into a trust moment. Rust `✦` + left-border chrome; fill reflects meaning (later finish = caution-soft, not alarm-red).
2. **Slip detection.** Henry flags *"✦ Drywall was due to finish yesterday and isn't marked done — running behind?"* with one-tap **Bump 1 day** / **Mark done**. Feeds the Overview strip + the tab badge (see §Slip detection).
3. **CO → schedule (closes the unlinked-CO gap #13).** When a Change Order is **approved/applied**, Henry offers *"✦ The approved CO adds 'Ensuite tile' — add it to the schedule after Drywall?"* → drafts the task(s); operator accepts/edits. Dovetails `change-order.md`; never auto-inserts.
4. **Bootstrap = honestly Henry-assisted.** Keep deterministic, but the empty-state + loading copy can credit it — *"✦ Henry sequenced your budget into a draft schedule — drag anything to adjust."* Stays fully editable; no AI offsets resurrected.
- **Voice already exists, off-screen:** `list_schedule_tasks` / `update_schedule_task` let the GC say *"push plumbing to the 18th"* from the Henry sidebar; nothing on-screen advertises it. A quiet *"Ask Henry to reschedule"* affordance is optional — not a chat panel.

## Connections (what Schedule wires to)
- **Budget** → bootstrap source (categories → trades → tasks via `phase-classifier.ts`). Target reconciliation: flag budget categories with **no scheduled task** ("3 budget categories aren't on the schedule yet").
- **Change Orders** → the #3 Henry touchpoint (currently unlinked).
- **Labour** → *plan vs actuals* pair; optionally cross-link a task to its logged hours (read-only). Never merge the surfaces (the Time→Labour rename exists to de-collide them).
- **Calendar (`/calendar`)** → the crew-this-week card deep-links here; **no write-back**. Schedule = timeline, Calendar = bodies.
- **Phases** (`project_phases`) → the Gantt's grouping + the portal phase-rail; Schedule is the phase-level timeline.
- **Customer portal** → firm-bar read-only view; add a **"Preview as customer"** affordance so the operator sees exactly what's shared before locking/notifying.
- **Overview "Needs You" strip** → schedule-slip + locked-dates cues flow up (the *"Electrical dates locked: Mar 24–27"* line `project-hub.md` relocates here originates from firm tasks).

## Role variations
- **Owner / admin / member:** full edit (drag, lock, add, dependencies, works-weekends, notify).
- **Homeowner (portal only):** `portal-schedule-gantt.tsx` — **firm bars only**, done/strike, high-disruption **amber "plan to be out"** warnings; **never** rough/draft dates, internal tasks, confidence/status internals, or notes. Carries the **GC's brand**, not HeyHenry chrome. (Boundary per Role Matrix.)
- **Worker:** **not on this tab.** Workers live in `/w`; their days come from `project_assignments` (the Calendar model), not `project_schedule_tasks`. *Open question:* a read-only view of the job's firm timeline in `/w` — a `/w` brief concern, out of scope here.

## Mobile vs desktop
*"Mobile = doing the work; desktop = thinking the work."* Schedule skews desktop for planning but must be field-usable.
- **Desktop:** full Gantt, drag/resize, hover quick-actions, "Depends on" editing, Preview-as-customer, crew-this-week card.
- **Mobile (capture-in-the-truck):** the **This-week digest is the default view** — active / next / **behind** as tappable rows with **Mark done** and **Bump a day** at ≥44px; the Gantt is a horizontal-scroll read-mostly view behind a toggle (drag-to-reschedule stays desktop — keep tap-to-edit as the mobile editor). Don't make a GC pinch-scroll a Gantt to mark drywall done.

## Financial / Canadian
Mostly **N/A** — Schedule carries dates, not money. Money only leaks in via the **CO→schedule** Henry prompt (any figure shown via `Money`, CAD). No GST / Interac / holdback surface here; don't invent a cost column (that's Budget/Spend).

## States
- **Empty:** `schedule-bootstrap-panel.tsx` 3-choice (Apply template / Build from budget / Start blank) → restyle to the §6 empty-state shape (icon + headline + line + the three CTAs as cards); credit Henry on "Build from budget."
- **Loading:** bootstrap overlay (budget mode 3–5s — keep, Henry-labeled); per-section skeleton on tab open.
- **Populated, on-track:** digest collapses to a calm *"On track — finishes May 30."*
- **Behind / at-risk:** digest leads with the behind count (danger-soft); slipped bars outlined; Henry slip prompt; Overview badge.
- **Notify queued:** the single inline Undo strip (restyled to `status-tokens`).
- **Error:** action failures via `toast` (§5), never native `alert()`.

## Accessibility
WCAG 2.2 AA. Bar state **never colour-only** — done carries the strike, behind carries an outline + glyph, firm/rough differ by fill *and* the legend; in_progress needs a non-colour cue; receded-weekend segments must not drop contrast below AA for the bar label. Quick-actions and digest rows are real buttons/links, keyboard-operable, ≥44px on mobile. The drag bar's `aria-label` tooltip + focusable resize handle — preserve on refactor. Sticky-left name column + horizontal scroll stay. Tab nav + `<select>` mirror (§9). Replace native dialogs (focus-trap + ESC come free with the §3 AlertDialog). Dates render in tenant tz (PATTERNS §23).

## Reject-if self-check (per `heyhenry-design-critique`)
- ✅ Grounded in real schema/actions (v2, not the stale "read-only"). ✅ Project is gravity. ✅ Henry = embedded leverage (cascade / slip / CO), not chat. ✅ No per-seat anything. ✅ Removes pressure rather than adding (demotes destructive buttons; crew stays at Calendar — no duplicate scheduler). ✅ Homeowner boundary respected (firm-only, no internals). ✅ Canadian N/A handled honestly. ✅ Mobile field-viable (digest-first). ⚠ Watch: keep "Schedule = timeline / Calendar = crew" crisp — do **not** re-introduce a crew editor here (the #269 deletion exists to prevent exactly that); CPM stays out (no critical-path engine).

## Open questions
- **Working-day migration.** Recompute existing `planned_duration_days` as working-days with a one-time notice, vs. add a `duration_basis` column defaulting old rows to `calendar`? (Recommend recompute + notice.)
- **Weekend rendering.** Continuous bar with receded weekend columns (recommended) vs. a segmented/broken bar across weekends — confirm in critique.
- **Status enum.** `scheduled` looks redundant with `confidence=firm`; `in_progress` is unrendered. Collapse to `planned → in_progress → done` + the rough/firm lever, or render all four? (Affects the bar vocabulary.)
- **Cascade-notify coupling.** Auto-queue the (undoable) customer notify when moved tasks are firm + client-visible, or always require an explicit tap? Lean explicit — the 5-min Undo already debounces.
- **"Lock dates" framing.** Confirm relabeling Confidence rough/firm → a "Share with customer / Lock dates" intent control reads clearly to a GC.
- **CO → schedule sequencing.** Depends on `change-order.md`'s apply hook; Henry drafts tasks at CO-apply vs. a manual "pull CO scope into schedule" button for v1.
- **Crew-this-week card scope.** Confirm read-only + deep-link is enough (vs. any inline reassign) — keeping it read-only is what protects the single-scheduler rule.
