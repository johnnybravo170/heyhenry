# OD Brief — Team checklists (`/checklists` — the cross-project crew-list rollup)

> **Grounded in:** `src/app/(dashboard)/checklists/page.tsx` (the rollup screen — "Team checklists"), query `src/lib/db/queries/project-checklist.ts` (**`listOpenChecklistRollup`** → projects with ≥1 open item; `listChecklistForProject` open-first + hide-window; `listCategoriesForProject` combobox; **`getChecklistHideHours`** tenant pref), component `src/components/features/checklist/team-checklist.tsx` (the shared add/check list, `chrome="bare"` when embedded) + `site-switcher.tsx`, actions `src/server/actions/project-checklist.ts`, schema `src/lib/db/schema/project-checklist-items.ts`, validator `src/lib/validators/project-checklist.ts` (`CHECKLIST_HIDE_HOURS_DEFAULT` = 48h). Data: **`project_checklist_items`** — `project_id`, `title`, `category` (nullable), `photo_storage_path`/`photo_mime` (an item can carry a photo), `created_by`, `completed_at`/`completed_by`, timestamps; tenant pref in `tenant_prefs` (namespace `checklist`, `hide_completed_after_hours`). **GC-native: keyed on `projects`** (not legacy `jobs`). Vault: Object Model `b4d880be`, Role × Object Matrix `03b1ccf4`. Siblings: **`worker-app.md`** (the worker Today embeds `TeamChecklist`), `project-hub.md` (per-project surface + the dashboard "Team checklist: N open across M jobs" chip), `settings.md` (Settings → Checklist sets the hide-window), `inbox.md` (Todos — the *owner-personal* list, distinct).
> **How to use:** render the **rollup** (total + per-project cards with the embedded bare checklist) at desktop + mobile, and the **`TeamChecklist`** item component (add · check · photo · category), then `heyhenry-design-critique`. It's simple — the value is clarity vs Tasks/Todos and a Paper restyle, not new structure.
>
> **Governing principle — the crew's running per-site list, owned by everyone on the job.** Not the formal work plan (that's **Tasks**), not the owner's private list (that's **Todos**). It's the informal jobsite running list — *"bring more 2×4s," "pick up the permit," "fix the scratch by the door"* — that **anyone on a project (operator or worker) can add or check**, captured from the field and rolled up for the operator. Keep it lightweight: a title, an optional category, an optional photo, done/not-done.
>
> **Current vs target:** built + live — a clean tenant-wide rollup (every project with open items, busiest first) embedding the per-project `TeamChecklist`; completed items auto-hide after the tenant's window (default 48h) but stay for audit. **Target (the deltas):** (1) **Paper restyle** (muted/plain cards today → status-tokens + the calm system); (2) **sharpen the Tasks-vs-Checklist distinction** so the two don't blur in the UI (below); (3) confirm the **entry point** — today it's a dedicated `/checklists` page + a dashboard chip; decide whether it earns top-nav or stays chip-reached. **Flagged** throughout.

**Object:** **Checklist Item** (`project_checklist_items`) — a crew-shared, per-project to-do/supply/reminder (title + optional category + optional photo), completable by anyone on the job. · **Roles:** owner/admin/member (the cross-project rollup + per-project); **worker** (add/check on their assigned project — via `/w` Today); client never. · **Primary action:** see what's outstanding across every site, and clear it; from the field, add what the crew needs in two taps.

## Purpose
The "what does each site still need?" surface. Formal **Tasks** are the planned work (phases, statuses, assignments); **Todos** are the owner's private list; **Team checklists** are the running crew list that lives between them — fast, shared, field-captured. `/checklists` lifts the per-project lists into one operator view: *"6 open across 3 jobs,"* busiest first, each expandable in place.

## Layout *(rollup — compose from `card`, the embedded `TeamChecklist`, a count chip)*
1. **Header** — "Team checklists" + "What the crew needs on each site. Anyone on a project can add or check items."
2. **Tally line** — "{N} open across {M} projects."
3. **Per-project cards** (busiest first) — project name (→ `/projects/[id]`) + customer + a **"{n} open"** chip; body = the embedded **`TeamChecklist`** (`chrome="bare"`) so the operator can check/add **inline** without leaving the rollup.
4. **Empty:** calm "Nothing open — when the crew adds something on a site, it shows up here grouped by job" + "Open a project."

## The Checklist Item + the `TeamChecklist` component
- **Add:** title + optional **category** (combobox suggesting this project's prior categories) + optional **photo** (`photo_storage_path`) — a field worker can snap "the cracked tile" as the item.
- **Check:** tap to complete (`completed_at`/`completed_by` — who cleared it). Completed items linger then auto-hide after the tenant window (default 48h; "never" supported) — still retained for audit.
- **Open-first ordering**; recently-completed shown crossed-off within the window.

## Where it lives (IA — one object, several surfaces)
| Surface | Role |
|---|---|
| **`/checklists`** (this screen) | Operator cross-project rollup |
| **Worker `/w` Today** (`worker-app.md`) | Per-project checklist card — the field capture/check surface (with site-switcher) |
| **Project hub** (`project-hub.md`) | Per-project checklist on the project |
| **GC dashboard chip** | "Team checklist: N open across M jobs" → `/checklists` |
| **Settings → Checklist** (`settings.md`) | The hide-completed-after-N-hours pref |

## Progressive disclosure
- **Snapshot:** the tally + the busiest projects.
- **Operational:** check/add inline per project (no navigation).
- **Detail:** a project link to the full hub; an item's photo.
- **Audit:** completed items persist (who/when) even after they drop off the UI.

## Henry intelligence touchpoints *(capture-assist; never auto-completes)*
- **Voice/photo → item** — "add to the Glenwood list: need more underlayment" or a snapped photo → a drafted checklist item; the worker confirms. Capture-now/clean-up-later.
- **Rollup nudge** — surface "Northbeam has 5 open, oldest 6 days" on the dashboard chip; deterministic, not a model. Per `[[feedback_henry_intelligence_not_chat]]` — Henry surfaces/drafts; the crew checks the box.

## The edges — don't blur these
| Object | What it is | vs Checklist |
|---|---|---|
| **Task** (`tasks`) | The **planned work** — phases, statuses (ready/in_progress/waiting/blocked/done), assignments, visibility | Formal + scheduled; checklist is the informal running list. Don't merge |
| **Todo** (`todos`, `inbox.md`) | The **owner's private** list | Personal, not crew-shared |
| **Selection / Idea** (`selections.md`) | Finish choices / inspiration | Material *decisions*, not "what to bring/do" |

## Role variations
- **Owner / admin / member:** the full rollup + per-project; add/check anywhere.
- **Worker:** add/check on **assigned** projects (the field surface in `/w`); no cross-project rollup (their view is per-site).
- **Client:** never — internal crew operations.

## Mobile vs desktop
- **Worker (mobile):** the capture + check surface — big tap targets, quick-add, photo from camera (it's a field list).
- **Operator (desktop):** the rollup is a "what's outstanding everywhere" overview; mobile operator glances the tally + busiest sites.

## States
- **Empty:** the "Nothing open" card (built) — keep it calm.
- **Completed-hide window:** completed items cross off then auto-hide after the tenant pref (default 48h); retained for audit.
- **Loading:** `force-dynamic`; a light skeleton on the rollup.
- **Error/offline:** add/check use the `{ ok, error }` shape; field add should tolerate a flaky signal (queue) consistent with the worker app's offline story (`worker-app.md`).

## Subscreen inventory
- **`TeamChecklist`** (add · check · category combobox · photo) — **MEDIUM → own component render** (it's reused on `/checklists`, `/w` Today, and the project hub — render it once, well).
- **Add-item with photo** — **LIGHT → inline.** Title + category + optional camera photo.
- **Settings → Checklist hide-window** — **LIGHT → spec in `settings.md`** (the only config).
- **Dashboard chip → `/checklists`** — not a subscreen; an entry point.

## Accessibility
WCAG 2.2 AA: items are a real list with proper checkboxes (label + state, not colour-only); the "{n} open" chip has an accessible label; project headings are real headings/links; ≥44px check targets (it's a field surface); the category combobox is keyboard-operable; completed/crossed-off state conveyed beyond strikethrough alone.

## Decisions / Open questions
1. **Tasks vs Checklist clarity (the headline)** — two "things to do" objects risk blurring. Recommend a clear UI/voice split: Tasks = planned work (the schedule), Checklist = the crew's running site list. Confirm naming so they read as distinct (an Ops/product call).
2. **Entry point** — keep the dedicated `/checklists` page + dashboard chip, or fold the rollup into the dashboard? Confirm whether it earns a top-nav slot.
3. **Paper restyle** — adopt status-tokens + the calm card system; verify the embedded bare checklist reads cleanly stacked.
4. **Offline parity** — field add/check should match the worker app's offline-queue behavior (`worker-app.md`); confirm it's covered.
