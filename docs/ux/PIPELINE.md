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
| Invoice detail (`/invoices/[id]`) | ✅ `invoice-detail.md` | ✅ `od-invoice-detail` | 1 (build `6b0f6cfc`) | 🟡 (built, pre-Paper) | render converged (2-round OD loop, restyle-only); friendly invoice # off the UUID (INV-2026-…) · customer-view preview as draft hero · drift + missing-GST as inline cautions · defaults+overrides → "Document details" disclosure · 4 status postures · math ties out · client-boundary clean (no margin). Customer counterpart `/view/invoice/[id]` → `customer-documents.md`. **subscreens: ✅ (invoice-detail.md)** |
| Business Health (owner money cockpit) | ✅ `business-health.md` | ✅ `od-business-health` | 0 (build `ca55937c` ✅) | 🟡 #313 | Paper restyle + cockpit hierarchy built (#313): money-side Henry attention strip (deterministic, mirrors Overview engine) · net-cash + AR-aging hero (bands tie out to RPC) · KPI row (owner-pay reconciles with draws) · owner-draws ledger · QBO "Is/Isn't" aside · states. **Deferred:** bank-import + bank-review (own renders). ✅-gate (live design-critique) pending |
| Calendar (crew scheduling) | ✅ `calendar.md` | 🟡 (no `od-calendar` dir) | — | ✅ #270–#275 | built ahead of a formal OD render |
| Estimate (Budget authoring) | ✅ | ✅ (project-hub budget) | — | ✅ #278/#281 | |
| Quotes (PW sales-quote object) | ✅ `quotes.md` | ⬜ (PW-only) | — | ✅ (PW live) | **PW-vertical** — GC `/quotes`→`/projects`; GC quoting = `estimate.md` + project Budget + `/approve*`. Brief = map + scope boundary; **recommend no GC render**. Open: auto-create-Project-on-approval decision |
| Change Order | ✅ | ✅ `od-change-order` | 0 (build `01a46861` ✅; voice/photo deferred) | 🟡 #310 | diff editor restyle + action palette (PATTERNS §29) + ops-only margin read; public `/approve` on the shared `<CustomerDocument>` shell (Before/After/Δ, province GST, e-sig/decline); send preview; "now billable" nudge; Changes view inside Budget; dead `change-orders-tab-server.tsx` removed (#310). **Deferred:** voice/photo drafting; `approved_unbilled_co` Overview rule (no CO↔invoice linkage). ✅-gate (live design-critique) pending |
| Expenses | ✅ | ✅ `od-expenses` | 0 (build `d681c249` ✅) | 🟡 #309 | ledger Paper restyle + `<Money>` + server-side filters/search/pagination; GST remittance restyle (last-closed-quarter default, missing-BN ✦ card); receipt import kept (#309). **Deferred:** wizard internals repaint, ledger CSV endpoint. ✅-gate (live design-critique) pending |
| Customer Documents | ✅ | ✅ `od-customer-documents` | 0 (build `1f5cd745` ✅) | 🟡 #308 | shared `<CustomerDocument>` shell built (#308: estimate adopts it; reusable for CO `/approve`) + invoice pay surface rebuilt (Stripe + Interac parity, province-aware GST, additive id→code keying). **Deferred:** security card (rate-limit/token on no-login PII pages). ✅-gate (live design-critique) pending |
| Settings (config hub · 30 sub-pages) | ✅ `settings.md` | ✅ `od-settings` | 1 (build `5aaf0e1d`) | 🟡 (live, pre-redesign) | render converged (2-round OD loop); **role-filter the nav DEMONSTRATED** (Owner + Member + permission "Owner only" frames) · Paper shell + 6-group IA · counts reconcile (owner 26/27 · member 21/27) · Canadian config (GST/HST · WCB · owner-draw GST · e-Transfer); **open: exact per-role visibility matrix — Ops confirm (brief Decision #1)**; heavy sub-flows (Team, Billing, QuickBooks, Import) graduate to own renders |

### Project Hub (shell + tabs)
| Tab | Brief | OD render | Open dev cards | Built (ref) | Notes |
|---|---|---|---|---|---|
| Hub shell (header/nav) | ✅ `project-hub.md` | ✅ `od-project-hub` | — | ✅ #268/#287 | |
| Overview | ✅ `overview.md` | ✅ `desktop.html` | **0** | 🟡 #268/#301/#306 | aggregator engine + Paper restyle (#301); `schedule_slip` rule wired (#304); 3-layer badge consistency (#306: nav badges + strip derive from one `cache()`-shared `getProjectInsights`, bucketed by `owningTab` — issue-TYPE counts; Client unread stays item-count by design). **Only outstanding:** `ready_to_bill` rule (no clean "next draw" source yet). ✅-gate (live design-critique) pending · **subscreens: ✅ (overview.md)** |
| Budget | ✅ (project-hub) | ✅ `…-budget` | — | ✅ #278/#281 | |
| Spend | ✅ (project-hub) | ✅ `…-spend` | — | ✅ #290/#291/#298 | |
| Labour | ✅ (project-hub) | ✅ `…-labour` | — | ✅ #294 | |
| Schedule | ✅ `schedule.md` | ✅ `…-schedule` | **0** (refinements only) | 🟡 #295/#303/#304/#305 | all 3 deep-work cards built: working-days (#303), slip/digest/chrome (#304), Henry cascade-explainer + notify + slip-prompt (#305). **Refinements outstanding (no open card yet):** CO→schedule inline prompt (`d0b1b72a` pt3, deferred — needs its own card: CO scope-line reads + on-tab surface + dedup) and bespoke mobile-Timeline variant. ✅-gate (live design-critique) pending · **subscreens: ✅ (schedule.md)** |
| Billing (project) | 🟡 (project-hub §Billing; no standalone) | ✅ `…-billing` | — | ✅ #296 | dedicated brief intentionally skipped |
| **Client** | ✅ `client.md` | ✅ `…-client` | **1** (Pulse pt1) | 🟡 #302 | chip + activity/setup reorg + decision ✦ chrome + Paper restyle built (#302); **outstanding:** wire Henry Pulse into Updates (card `b9bb93b7` pt1 — needs project-scoped `pulse_updates`: nullable `job_id` + `project_id` + project draft path; currently job-scoped) |
| Photos / Documents / Notes | ✅ `project-secondary-tabs.md` | ✅ `od-secondary-tabs` | 1 (build `17401e13`) | 🟡 (live, pre-redesign) | render converged (2-round OD loop); 3 tabs in hub shell · **client-visibility label+glyph badges** (Internal / Client-visible, never colour-only) · COI-internal default + expiry · **Ask-Henry-as-action** (answer drops into feed, not chat) + internal-only banner · Henry suggest-confirm photo tags/captions · mobile offline-capture queue; **Home Record graduates to own render (`home-record.md`)** |
| Selections (per-room finishes) | ✅ `selections.md` | ⬜ | — | 🟡 (live, pre-redesign) | dual-authored (operator + client) finish schedule; **target: surface allowance-vs-actual variance (→ CO trigger), Paper restyle**; idea-board promotes in; feeds Home Record |

### Worker & public surfaces (separate route groups)
| Surface | Brief | OD render | Open dev cards | Built (ref) | Notes |
|---|---|---|---|---|---|
| Worker app `/w` (mobile field surface) | ✅ `worker-app.md` | ⬜ | — | 🟡 (live, W1–W7 built) | mobile-only; **target: fix 8-item bottom-nav overload, Paper restyle, offline capture**; heavy sub-flows (time/expense/invoice capture) graduate to own renders |
| Public pages (`/portal`, `/estimate`, `/approve`, `/decide`, `/view`, `/pulse`, `/home-record`) | ✅ `public-pages.md` | ⬜ | — | 🟡 (live, pre-redesign) | client-facing, no-login, brand-carrying family; **target: one unified branded Paper template + the absolute client boundary**; approval family + Portal + Home Record + Pulse graduate to own renders |

---

## Untouched screens — menu for the next research pass
> ✅ **Sweep complete — `research-0523` (2026-05-23) briefed every actionable screen on this menu.** Promoted into the tables above with briefs: **Business Health** (`business-health.md`), **Quotes** (`quotes.md`), **Settings** (`settings.md`), **Project secondary tabs / Photos·Documents·Notes** (`project-secondary-tabs.md`), **Worker app `/w`** (`worker-app.md`), **Public pages** (`public-pages.md`). The only remaining item is intentionally deferred:

- **Bookkeeper portal** (`/bk`) — **deferred, out of redesign scope for V1 — confirmed by the sweep.** Real + shipped, but scoped out by Role × Object Matrix `03b1ccf4` (`/bk` financial-only, "out of redesign scope"), Object Model `b4d880be` (Bookkeeper-domain tables out of scope), and Workflow Library `e0263cc3` (#8 Bookkeeper Review — deferred, separate portal). Revisit only if it re-enters scope.

**Gaps surfaced during the sweep — all addressed:**
- **Project → Selections tab** — found un-briefed during the sweep, **now briefed** (`selections.md`, 2026-05-23) and promoted into the Project Hub table above.

## Scope ledger — the honest done-line (2026-05-23)
The redesign-scope surface is briefed; everything else is explicitly classified.

**Graduated heavy flows — briefed ✅** (sub-flows that earned their own brief out of a screen's Subscreen Inventory):
`invoice-detail.md` (`/invoices/[id]`) · `bank-reconciliation.md` (import + review) · `home-record.md` (closeout) · `settings-team.md` · `settings-billing.md` · `settings-quickbooks.md` (QBO hub, 4 routes) · `settings-import.md`. Most are built/live (pre-Paper) → OD render + restyle next; bank-recon + home-record carry build deltas flagged in-brief. *(`<CustomerDocument>` shell → `customer-documents.md` + render `od-customer-documents` + card `1f5cd745`.)*

**Genuinely unbriefed GC surfaces — the only open gaps:**
- **Onboarding** (`(auth)/onboarding` — first-run signup / plan-picker). *Recommend: brief if pre-launch polish matters; lower urgency (no firm launch date; soft-launch posture).*
- **Referrals** (`(dashboard)/referrals` — growth program). *Recommend: defer to V1.1 — not core run-the-job.*

**Out of redesign scope (intentionally not briefed):**
- **Bookkeeper portal** (`/bk`) — deferred (see the sweep note above; Role Matrix `03b1ccf4` / Workflow #8).
- **`admin`** (internal ops UI) · **`social`** (ops marketing drafts) · **`lead-gen` + `leads`** (PW-vertical public lead capture; GC leads = Contacts) · **legacy `jobs` + PW quotes** (`quotes.md` maps the PW→GC boundary; GC uses Projects).
- **Owner Dashboard** (`dashboard.md`) — owner optimizes on a separate track ("don't touch").

**Net:** every GC-V1 redesign screen + its heavy subscreens is briefed; **onboarding + referrals** are the only deferred GC gaps; the rest is out-of-scope by design.

## Cross-cutting items
- **"client" not "homeowner" terminology sweep** — Ops decision `1d055427`; dev card `2eab19b2` (12 briefs + sacred-path + vault Role × Object Matrix `03b1ccf4` + the 2 design skills). Folded into the reconciliation pass. Keep "customer" for data/product terms.
- **OD→build contract:** `docs/ux/HANDOFF-TO-BUILD.md` (tokens + class names + data bindings so builds don't drift from screenshots).
- **Subscreen-inventory backfill — ✅ COMPLETE** (2026-05-23) across all 13 briefed screens (Schedule · Client · Overview · Estimate · Change-Order · Invoices · Contacts · Expenses · Calendar · Projects-list · Inbox · Customer-Documents · Project-Hub) — each brief now carries a `## Subscreen inventory`. **Graduates — both handled:** `/invoices/[id]` now has its own brief + row (`invoice-detail.md`); the `<CustomerDocument>` shared shell is specced in `customer-documents.md` (render `od-customer-documents` + build card `1f5cd745`) — a shared-component (PATTERNS) extraction, not a separate brief. New screens get their inventory inline via the skill's Subscreen-Inventory step.

---

## How to update this doc
When you finish your stage for a screen: flip the cell (⬜→🟡→✅), add the ref (commit/card/render path), and commit `PIPELINE.md` alongside your work. If you discover a cell is wrong, fix it — it's only useful if it's true. **Subscreens count:** a screen isn't fully designed until its Subscreen Inventory is done (skill step 8) — track it in the row's Notes (e.g. `subscreens: 🟡 3/6 specced`), and don't mark a screen ✅ Built+Verified with un-specced heavy subscreens. Foundation docs + skills: `docs/ux/HANDOFF.md`, `docs/ux/README.md`, `.claude/skills/heyhenry-*`.
