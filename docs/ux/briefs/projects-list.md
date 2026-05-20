# OD Brief — Projects (list)

> **Grounded in:** `src/app/(dashboard)/projects/page.tsx`, `projects-table.tsx`, `project-tabs.tsx`, `cost-lines.ts`, `validators/project.ts`. **How to use:** paste into the OD project (HeyHenry "Paper" palette — deepened), generate hi-fi desktop + mobile, then run `heyhenry-design-critique`.
> **Current vs. target:** today this screen uses limited tabs, a 200-row cap, and shows two metrics. This brief specifies the **target** (filter bar, pagination, one metric + flag) — flagged where it differs from current.

**Object:** Project (list) · **Roles:** owner / admin / member · **Primary action:** open a project (or New project)

## Purpose
The operator's at-a-glance list of every project — what stage, whose, how far along, and which are bleeding budget — with one tap into any project, fast filtering, and a quick new/import path.

## Layout
- **Header:** "Projects" + subhead "{n} active · {n} complete". Right: **Import with Henry** + **New project** (primary, ink).
- **Filter bar (target — replaces the old tabs):**
  - **Status filter** (multi-select chips): planning · awaiting approval · active · on hold · declined · complete · cancelled. **Default: planning + awaiting approval + active shown; on_hold / declined / cancelled hidden until toggled on.**
  - **Search** (project name or customer) · **Sort**.
- **Table:** Project (name — inline-editable, links to detail) · Customer (links to contact) · Status (lifecycle badge) · Start · **% complete** + over-budget flag · Clone (row action). All columns sortable.
- **Pagination (target)** — replaces the current 200-row hard cap; server-side, driven by the filter/search.

## Progress — one number + a flag
Show a **single "% complete"** per row (`work_status_pct`). When over budget (`cost_burn_pct > 100`), surface an explicit **"⚠ over budget" flag** (small red chip) on the row. No second "burn %" number. Healthy: `47%`. Over budget: `47% · ⚠ over budget`.

## Status — all in one table
The 7-stage `lifecycle_stage` renders as a status badge in the single table (no separate view). **Awaiting-approval rows carry a quiet secondary cue — "sent 3d ago"** — so proposals waiting on the customer don't go stale when folded into the list. (Estimate total / viewed-count detail lives in the project detail, not the list row.)

## Henry intelligence
- **Import with Henry** (real) — AI-assisted bulk project import.
- *(Target — flag as such)* surface at-risk (over-budget) projects for attention — e.g. a "needs attention" quick-filter or sort.

## Mobile vs desktop
- **Desktop:** filter bar + sortable table + pagination.
- **Mobile:** table degrades to stacked cards (keep the status badge, the over-budget flag, and the awaiting "sent Nd ago" cue visible). Filters collapse into a sheet/dropdown.

## States
- **Empty (no projects):** "Create your first renovation project to get started." + New project.
- **Filtered-empty:** "No projects match these filters." + a clear-filters affordance.

## Visual identity
Deepened **"Paper"** palette (approved): warm paper, white cards that float, solid warm borders, ink text. Over-budget flag in danger red; rust as the single accent per screen. Status badges via the existing status-token tones.

## Open questions
- Should the over-budget flag also power a one-click "needs attention" filter/sort? (Minor — can decide off the OD output.)
