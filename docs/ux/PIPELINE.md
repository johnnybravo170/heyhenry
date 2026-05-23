# HeyHenry UX Redesign — Pipeline & Screen Status

**This is the single source of truth for the redesign pipeline. Every design/build session reads it FIRST and updates it on handoff.** It exists to kill the #1 time sink: re-discovering what's already done.

---

## The pipeline (three sessions, three lanes)

```
RESEARCH ───briefs──▶ OD DRIVER ───renders+cards──▶ CODING
(analysis)            (the bottleneck)               (the Mini)
```

| Session | Owns (writes) | Produces | Reads |
|---|---|---|---|
| **Research** | `docs/ux/briefs/*.md` + this tracker | grounded screen briefs (workflow analysis, current-vs-target, real-code grounding) | vault Module docs, real code, foundation docs |
| **OD Driver** | OD prompts, `od-*/` renders, **Dev cards** on the Ops `dev` board | hi-fi renders + critique + the build cards | the brief for the screen |
| **Coding** (Mini) | `src/**` + commits | the implemented screen | the brief + the render + the dev card |

**Lane discipline (this prevents the duplicate-work we hit):** one session owns each artifact type. Research writes **only briefs** (+ this tracker). OD Driver owns **prompts, renders, and dev cards**. Coding owns **commits to `src`**. Don't create dev cards from Research; don't write briefs from OD Driver. *(The duplicate Schedule card happened because card-creation wasn't lane-owned.)*

**Verified = the Coding done-gate (no separate QA session).** Before flipping a screen to ✅ Built, Coding runs `heyhenry-design-critique` against the **live built screen** (not the OD render), logs residual design↔code variance as a Notes entry here + a follow-up card if material. Same critique skill, pointed at the app — keeps us to three lanes and off the OD-Driver bottleneck.

---

## Session-start protocol (do this every time, every session)

**0. Work in your OWN git worktree — never share one checkout.** Multiple agents on a single working copy race on git state — divergent commits, duplicate-SHA history, stash churn, even transient `rev-parse`/ref failures (we hit all of these). Each session gets its own worktree on its own branch:
```
git worktree add .claude/worktrees/<session> -b ux/<session> origin/main
cd .claude/worktrees/<session>
bash scripts/setup-worktree.sh   # symlinks .env files; idempotent
pnpm install                     # only if node_modules is empty
```
Research / OD Driver / Coding each run in a separate worktree so they never step on each other. See `AGENTS.md` §"Working in a worktree". *(The Coding/Mini lane already works on PR branches — this brings the design lanes in line.)*

> **⚠ OD Driver caveat — the worktree doesn't isolate renders.** The OD daemon writes renders to its project's *fixed* `baseDir`, so a fresh per-session worktree never receives them — they land in whatever checkout the daemon points at. So the OD Driver lane keeps **one stable checkout = the daemon's `baseDir`** (don't recreate it per session) and stays clear of the other sessions with `git pull --rebase` before every commit/push — scope commits to `od-*/` renders + this file's cell (Ops `dev` cards aren't git, so no race there). The ephemeral `ux/<session>` worktree is really a **Coding-lane** device — it isolates `src/` edits, which the OD Driver doesn't make. To isolate the OD Driver fully, point the daemon at a dedicated persistent OD checkout and leave it there.

1. **`git pull --rebase origin main`** — never work stale. (Most cross-session mixups this arc came from a stale checkout.)
2. **Read this file** — find your screen's row; confirm the upstream stage is done before you start yours.
3. **Work only your lane's artifact.**
4. **On handoff, update this file** — flip your stage's cell + drop the ref (commit SHA / card id / render path). Commit it with your work.
5. **Transport is git + the Ops board, not copy-paste.** Briefs live in `docs/ux/briefs/`, renders in `od-*/`, cards on the `dev` board (`epic:ux-redesign`). Read from there; the human is a checkpoint, not the courier. *(OD step is going headless via the `od-redesign-loop` skill.)*

**Claim before you start (two research agents now run in parallel).** Before working a screen, mark its **Brief** cell `🟡 (in progress: <your-session>)` and commit that line — so two researchers never write the same brief. Flip to ✅ when you hand off. Same rule for any lane picking up a screen.

---

## Screen status

Legend: ✅ done · 🟡 partial / deeper work open · ⬜ not started · — n/a · **?** unconfirmed (owning session: verify)

### Global screens
| Screen | Brief | OD render | Open dev cards | Built (ref) | Notes |
|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ `od-dashboard` | — | ✅ #297 | **Owner optimizes separately — don't touch** |
| Contacts | ✅ | ✅ `od-contacts` | — | ✅ #273/#276/#292/#299 | |
| Projects list | ✅ | ✅ `od-projects-list` | — | ✅ #277 | |
| Inbox | ✅ | ✅ `od-inbox-triage` | — | 🟡 ? | build state unconfirmed |
| Billing / AR (cross-project) | ✅ `invoices.md` | ✅ `od-billing` | — | ✅ #288 | |
| Business Health (owner money cockpit) | ✅ `business-health.md` | ⬜ | — | 🟡 (live, pre-redesign) | restyle to Paper/status-tokens + cockpit hierarchy outstanding; **subscreens: bank-import + bank-review graduate to own renders** |
| Calendar (crew scheduling) | ✅ `calendar.md` | 🟡 (no `od-calendar` dir) | — | ✅ #270–#275 | built ahead of a formal OD render |
| Estimate (Budget authoring) | ✅ | ✅ (project-hub budget) | — | ✅ #278/#281 | |
| Quotes (PW sales-quote object) | ✅ `quotes.md` | ⬜ (PW-only) | — | ✅ (PW live) | **PW-vertical** — GC `/quotes`→`/projects`; GC quoting = `estimate.md` + project Budget + `/approve*`. Brief = map + scope boundary; **recommend no GC render**. Open: auto-create-Project-on-approval decision |
| Change Order | ✅ | 🟡 (in progress: od-driver) | "voice/photo drafting" | 🟡 | manual flow built; refinements open |
| Expenses | ✅ | ⬜ | — | 🟡 ? | |
| Customer Documents | ✅ | ⬜ | — | 🟡 ? | |

### Project Hub (shell + tabs)
| Tab | Brief | OD render | Open dev cards | Built (ref) | Notes |
|---|---|---|---|---|---|
| Hub shell (header/nav) | ✅ `project-hub.md` | ✅ `od-project-hub` | — | ✅ #268/#287 | |
| Overview | ✅ `overview.md` | ✅ `desktop.html` | **1** (badge-consistency pt2) | 🟡 #268/#301 | aggregator engine + Paper restyle built (#301: margin-at-risk + 6 ranked rules, status-tokens + rust ✦); **outstanding:** 3-layer badge consistency (card `890e6f4d` pt2), + `ready_to_bill`/`schedule_slip` rules (sources not yet available) · **subscreens: ✅ (overview.md)** |
| Budget | ✅ (project-hub) | ✅ `…-budget` | — | ✅ #278/#281 | |
| Spend | ✅ (project-hub) | ✅ `…-spend` | — | ✅ #290/#291/#298 | |
| Labour | ✅ (project-hub) | ✅ `…-labour` | — | ✅ #294 | |
| Schedule | ✅ `schedule.md` | ✅ `…-schedule` | **3** (working-days; slip+digest+chrome; Henry) | 🟡 #295 | Paper-fidelity built; working-day/slip/Henry deep work outstanding · **subscreens: ✅ specced inline (schedule.md)** |
| Billing (project) | 🟡 (project-hub §Billing; no standalone) | ✅ `…-billing` | — | ✅ #296 | dedicated brief intentionally skipped |
| **Client** | ✅ `client.md` | ✅ `…-client` | **1** (Pulse pt1) | 🟡 #302 | chip + activity/setup reorg + decision ✦ chrome + Paper restyle built (#302); **outstanding:** wire Henry Pulse into Updates (card `b9bb93b7` pt1 — needs project-scoped `pulse_updates`: nullable `job_id` + `project_id` + project draft path; currently job-scoped) |
| Photos / Documents / Notes | ✅ `project-secondary-tabs.md` | ⬜ | — | 🟡 (live, pre-redesign) | Paper restyle + client-visibility legibility outstanding; **Home Record generate/email + Photos graduate to own renders**; **gap flagged: Selections tab un-briefed** |

---

## Untouched screens — menu for the next research pass
> 🟡 **In progress — `research-0523` (2026-05-23) is sweeping this entire list in one Research pass.** Each screen is promoted into the status tables above (✅ Brief + ref) as its brief lands; bullets are removed from this menu as they complete.

Not yet briefed; **claim one** (mark it in-progress) before starting. Most are subscreen-dense — apply the skill's Subscreen Inventory step.
- **Settings** (+ sub-pages: Team/invite, Pricebook/materials, Portal defaults, Calendar, Billing/subscription)
- **Worker app `/w`** (Today · Calendar · Projects · Profile + the worker-invoice queue; plan W1–W7 in `GC_WORKFLOW_PLAN.md`) — its own mobile-first surface, a big pass
- **Public pages** — estimate / CO / invoice approval (`/approve*`), and the **customer Portal** itself (`/portal/[slug]`, customer-facing; carries the GC's brand)
- **Bookkeeper portal** — *deferred (out of scope for V1)*; listed so it's not forgotten

## Cross-cutting items
- **"client" not "homeowner" terminology sweep** — Ops decision `1d055427`; dev card `2eab19b2` (12 briefs + sacred-path + vault Role × Object Matrix `03b1ccf4` + the 2 design skills). Folded into the reconciliation pass. Keep "customer" for data/product terms.
- **OD→build contract:** `docs/ux/HANDOFF-TO-BUILD.md` (tokens + class names + data bindings so builds don't drift from screenshots).
- **Subscreen-inventory backfill — ✅ COMPLETE** (2026-05-23) across all 13 briefed screens (Schedule · Client · Overview · Estimate · Change-Order · Invoices · Contacts · Expenses · Calendar · Projects-list · Inbox · Customer-Documents · Project-Hub) — each brief now carries a `## Subscreen inventory`. **Graduated to their own row/brief:** `/invoices/[id]` (invoice detail + customer-view override editor) and the `<CustomerDocument>` shared shell. New screens get their inventory inline via the skill's Subscreen-Inventory step.

---

## How to update this doc
When you finish your stage for a screen: flip the cell (⬜→🟡→✅), add the ref (commit/card/render path), and commit `PIPELINE.md` alongside your work. If you discover a cell is wrong, fix it — it's only useful if it's true. **Subscreens count:** a screen isn't fully designed until its Subscreen Inventory is done (skill step 8) — track it in the row's Notes (e.g. `subscreens: 🟡 3/6 specced`), and don't mark a screen ✅ Built+Verified with un-specced heavy subscreens. Foundation docs + skills: `docs/ux/HANDOFF.md`, `docs/ux/README.md`, `.claude/skills/heyhenry-*`.
