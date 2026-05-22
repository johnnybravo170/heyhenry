# HANDOFF — HeyHenry UX overhaul (screen-by-screen redesign loop)

*Paste-able context for the next design session. Read the linked docs; don't trust this summary for detail.*

## Mission
Continuing a screen-by-screen UX overhaul of HeyHenry (Next.js 16 contractor app, Canadian GC/renovation vertical, "Paper" design system). Repo: `/Users/jonathanboettcher/Claude/heyhenry-app`.

**Loop:** grounded **brief** (`docs/ux/briefs/*.md`) → paste an **OD prompt** into Open Design on this machine → hi-fi desktop+mobile render → critique (`heyhenry-design-critique` skill) → brief + OD render feed **Dev cards** (Ops kanban board `dev`, `epic:ux-redesign`) → the **Mac Mini** codes it. Design = laptop; code = Mini; both share the repo via git; the Ops vault syncs via cloud. ALL HeyHenry kanban/knowledge → the **Ops MCP** (`mcp__6ef61ae4-…`), never HenryOS.

## THE #1 RULE (hard-won — do not skip)
Before designing/prompting ANY screen, ground in BOTH the real code AND the existing analysis, **in this order**:
1. **Ops vault** — `knowledge_search` for the screen's **`Module:` doc** (`auto:doc-writer` evergreen current-state analyses, e.g. `Module: project_costs`, `Module: Project Budget tab`, `Module: change-orders`). Results are huge — use `limit` 1–2.
2. **Read the real components.**
3. Check **`GC_WORKFLOW_PLAN.md`** (repo root — the user's GC workflow + full worker-app plan).

We burned a cycle by prompting "Spend" as a Budget clone because we skipped the vault `Module:` doc. **Never design from an idealized/consistent flow.**

## Start by reading
`DESIGN.md`, `DESIGN-NOTES.md` (code bridge), `PATTERNS.md`; `docs/ux/sacred-path-map.md`; `docs/ux/briefs/project-hub.md`; `GC_WORKFLOW_PLAN.md`; and the relevant `Module:` vault doc.

## Where things live
- **Briefs (committed):** `docs/ux/briefs/{contacts,projects-list,invoices,inbox,estimate,project-hub,change-order,customer-documents,expenses,dashboard}.md` + `sacred-path-map.md`.
- **OD renders (committed = the build reference):** `od-project-hub/`, `od-billing/`, `od-contacts/`, `od-projects-list/`, `od-dashboard/` (desktop+mobile). OD output = self-contained static HTML/CSS mockups, **NOT app code** — reference only; coder rebuilds in Next 16 / Tailwind v4 / shadcn (radix-nova). `.gitignore`: `od-*` committed; `*-Screenshot-*.png` + `.od-skills` ignored.
- **User's research:** `GC_WORKFLOW_PLAN.md`; vault `Module:` docs; source docs (`SPEC-v1.md`, JobTread model, renovation competitive analysis, Workflow Library `e0263cc3`, Project Hub V1 Spec `6c0de27d`).
- **Dev cards:** Ops `dev` board, tag `epic:ux-redesign` (13 created this arc + 5 prior).

## Status
- Sacred path mapped end-to-end. Decisions: **QBO import-only is fine for V1**; **quote→project auto-create is a PW non-issue for GC** (project predates the estimate).
- Briefs exist for all sacred-path screens. OD'd + critiqued: Project Hub **Overview + Budget** (strong). **Spend**: re-grounded + corrected prompt delivered (matches `Module: project_costs`).
- The Mini ALREADY MERGED code for the Project Hub redesign (**PR #268**) + a relabel commit ("Committed→Projected Cost", "Overhead→General Overhead"). **Code-merged ≠ design-shipped — design leads, code follows.** #268 predates the latest refinements.

## IMMEDIATE NEXT ACTION (user approved)
Run a **reconciliation pass** before any more OD prompts — check each brief against the existing analysis and cite the sources in the brief:
- Budget brief ↔ vault `Module: Project Budget tab`
- Change-order brief ↔ vault `Module: change-orders`
- Labour tab + crew ↔ `GC_WORKFLOW_PLAN.md` worker-app plan (W1–W7, `worker_invoices`, `project_assignments`)

Then resume per-screen OD prompts (**next up: Labour**), each grounded `Module:`-doc-first.

## Locked decisions / conventions (don't re-litigate)
- **Header = identity only:** name + `▾` (opens Project Details card: name/customer/desc/dates/billing/mgmt-fee + Crew roster) + status badge + quiet linked customer + `✦ Add` ghost + `⋯` overflow. **No metrics in the persistent header.**
- **Alert model:** Overview "Needs You" strip aggregates ALL alerts (ranked, ~4 + "+N more"); tab-label badges = per-tab counts; compact chips on the owning tab; **no stacked banners**; mobile: count on the nav-select trigger + per-option badges.
- **Tab IA:** `Budget · Spend · Labour · Schedule · Billing · Overview` + `Client² · Photos · Documents`. Renames **Time→Labour**, **Customer Billing→Billing** (label-only, keep route keys). Client hub = Messages/Selections/Portal&Updates. Crew→Details card; Notes→Overview activity.
- **Budget table:** ONE aligned grid section→category→line (not nested sub-tables), sticky column headers, collapsed sections show "estimate · % used · flag", per-line Remaining = Est−Spent−Committed, line state by column position (drop desktop status tags; mobile keeps them).
- **Spend = procurement/AP workflow (NOT a Budget clone):** By type default (Vendor quotes / POs / Costs), the sub-quote OCR→allocate-to-buckets→Accept pipeline is the centerpiece, "Did you pay this already?" cost gate, 3-cell summary (Committed/Billed/Paid; surface **Unpaid** as the rust actionable). By category = secondary read-only reconcile lens.
- **Terminology: use "Committed"** (NOT "Projected Cost" — researched: Projected Cost = Estimate at Completion, a different/forecast concept). The code's relabel should revert.
- **Discipline:** Paper palette; **3 type sizes** (16/14/12); **rust = the ONE accent** (primary actions + Henry actions only); status via `status-tokens` soft pairs (never raw red/amber/blue); Money CAD tabular + **de-emphasized cents**; Henry embedded (not chat), `✦` ONLY on real Henry actions (e.g. "Upload quote"), no per-row sparkles; Canadian (GST/HST/WCB/Interac); 44px+ mobile; customer-facing pages carry the GC's brand, not HeyHenry chrome.

## Gotchas
- **Git:** shell cwd resets — `cd` into the repo for git. Commits attribute to a local-hostname email (`…@Jonathans-MacBook-Pro-2.local`) — flag before pushing; don't touch git config without asking. Remote diverges often (Mini pushes) → `git pull --rebase` before push. **Push only when explicitly asked.**
- **`.gitignore`:** OD renders (`od-*`) ARE committed (build reference); loose screenshots + `.od-skills` ARE ignored.
- **Don't touch the owner Dashboard** (`/dashboard`, `docs/ux/briefs/dashboard.md`) — the user optimizes it on a separate track.
- **Tools:** Ops kanban (`kanban_card_create`/`list`, board_slug `dev`), `knowledge_search` (low limit — results are huge). Skills: `heyhenry-{workflow-mapping, ooux, screen-design, design-critique}` — use per screen.
