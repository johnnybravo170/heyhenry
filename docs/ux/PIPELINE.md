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
| Calendar (crew scheduling) | ✅ `calendar.md` | 🟡 (no `od-calendar` dir) | — | ✅ #270–#275 | built ahead of a formal OD render |
| Estimate (Budget authoring) | ✅ | ✅ (project-hub budget) | — | ✅ #278/#281 | |
| Change Order | ✅ | ⬜ ? | "voice/photo drafting" | 🟡 | manual flow built; refinements open |
| Expenses | ✅ | ⬜ | — | 🟡 ? | |
| Customer Documents | ✅ | ⬜ | — | 🟡 ? | |

### Project Hub (shell + tabs)
| Tab | Brief | OD render | Open dev cards | Built (ref) | Notes |
|---|---|---|---|---|---|
| Hub shell (header/nav) | ✅ `project-hub.md` | ✅ `od-project-hub` | — | ✅ #268/#287 | |
| Overview | ✅ `overview.md` | ✅ `desktop.html` | **2** (aggregator engine; restyle+badges) | 🟡 #268 | cockpit shell built; **aggregator engine outstanding** (design ahead of code) |
| Budget | ✅ (project-hub) | ✅ `…-budget` | — | ✅ #278/#281 | |
| Spend | ✅ (project-hub) | ✅ `…-spend` | — | ✅ #290/#291/#298 | |
| Labour | ✅ (project-hub) | ✅ `…-labour` | — | ✅ #294 | |
| Schedule | ✅ `schedule.md` | ✅ `…-schedule` | **3** (working-days; slip+digest+chrome; Henry) | 🟡 #295 | Paper-fidelity built; **working-day/slip/Henry deep work outstanding** |
| Billing (project) | 🟡 (project-hub §Billing; no standalone) | ✅ `…-billing` | — | ✅ #296 | dedicated brief intentionally skipped |
| **Client** | ✅ `client.md` | ✅ `…-client` | **2** (wire Pulse + reorg; chip+restyle) | ⬜ | briefed 2026-05-22; **build not started** |
| Photos / Documents / Notes | 🟡 (project-hub) | ⬜ | — | ? | secondary tabs; lower priority |

---

## Cross-cutting items
- **"client" not "homeowner" terminology sweep** — Ops decision `1d055427`; dev card `2eab19b2` (12 briefs + sacred-path + vault Role × Object Matrix `03b1ccf4` + the 2 design skills). Folded into the reconciliation pass. Keep "customer" for data/product terms.
- **OD→build contract:** `docs/ux/HANDOFF-TO-BUILD.md` (tokens + class names + data bindings so builds don't drift from screenshots).

---

## How to update this doc
When you finish your stage for a screen: flip the cell (⬜→🟡→✅), add the ref (commit/card/render path), and commit `PIPELINE.md` alongside your work. If you discover a cell is wrong, fix it — it's only useful if it's true. Foundation docs + skills: `docs/ux/HANDOFF.md`, `docs/ux/README.md`, `.claude/skills/heyhenry-*`.
