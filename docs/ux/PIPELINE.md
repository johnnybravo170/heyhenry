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

**Verified = the Coding done-gate (no separate QA session) — desktop AND mobile.** Before flipping a screen to ✅ Built, run `heyhenry-design-critique` against the **live built screen at BOTH a desktop and a phone viewport** (not the OD render). A screen isn't ✅ until its **mobile** pass clears against the brief's "Mobile vs desktop" section + the rubric's Mobile/field-viability dimension. Log residual design↔code variance as a Notes entry here + a follow-up card if material. Same critique skill, pointed at the app — keeps us to three lanes and off the OD-Driver bottleneck.

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
| Invoice detail (`/invoices/[id]`) | ✅ `invoice-detail.md` | ✅ `od-invoice-detail` | 0 (build `6b0f6cfc` ✅) | 🟡 #315 | Paper restyle built (#315): friendly invoice # via shared `invoiceDocNumber()` off `invoices.code` (INV-<code8>; no sequential # in schema) · customer-view preview as draft hero · drift + missing-GST as inline cautions · defaults+overrides → "Document details" disclosure · 4 status postures · §25 gate + no-margin preserved. Customer counterpart `/view/invoice/[id]` → `customer-documents.md`. ✅-gate (live design-critique) pending |
| Business Health (owner money cockpit) | ✅ `business-health.md` | ✅ `od-business-health` | 0 (build `ca55937c` ✅) | 🟡 #313 | Paper restyle + cockpit hierarchy built (#313): money-side Henry attention strip (deterministic, mirrors Overview engine) · net-cash + AR-aging hero (bands tie out to RPC) · KPI row (owner-pay reconciles with draws) · owner-draws ledger · QBO "Is/Isn't" aside · states. **Deferred:** bank-import + bank-review → now ✅ `od-bank-reconciliation` (row below). ✅-gate (live design-critique) pending |
| Bank reconciliation (`/business-health/bank-*`) | ✅ `bank-reconciliation.md` | ✅ `od-bank-reconciliation` | 0 (build `d220e940` ✅) | 🟡 #320 | built (#320): status-tokens + glyph confidence bands · ✦ deterministic matcher (rubric, never auto-confirms) + "how Henry matched" disclosure · signed in/out glyph+tone · AlertDialog (bulk confirm/reject) · loading/error states · Re-run matching · **owner+admin gate (route + server-side on all 4 money-write actions)**. ⚠ built brief-only (render landed mid-build, undiffed) — **render-fidelity pass owed at ✅-gate**. ✅-gate (live design-critique) pending |
| Calendar (crew scheduling) | ✅ `calendar.md` | 🟡 (no `od-calendar` dir) | — | ✅ #270–#275 | built ahead of a formal OD render |
| Estimate (Budget authoring) | ✅ | ✅ (project-hub budget) | — | ✅ #278/#281 | |
| Quotes (PW sales-quote object) | ✅ `quotes.md` | ⬜ (PW-only) | — | ✅ (PW live) | **PW-vertical** — GC `/quotes`→`/projects`; GC quoting = `estimate.md` + project Budget + `/approve*`. Brief = map + scope boundary; **recommend no GC render**. Open: auto-create-Project-on-approval decision |
| Change Order | ✅ | ✅ `od-change-order` | 0 (build `01a46861` ✅; voice/photo deferred) | 🟡 #310 | diff editor restyle + action palette (PATTERNS §29) + ops-only margin read; public `/approve` on the shared `<CustomerDocument>` shell (Before/After/Δ, province GST, e-sig/decline); send preview; "now billable" nudge; Changes view inside Budget; dead `change-orders-tab-server.tsx` removed (#310). **Deferred:** voice/photo drafting; `approved_unbilled_co` Overview rule (no CO↔invoice linkage). ✅-gate (live design-critique) pending |
| Expenses | ✅ | ✅ `od-expenses` | 0 (build `d681c249` ✅) | 🟡 #309 | ledger Paper restyle + `<Money>` + server-side filters/search/pagination; GST remittance restyle (last-closed-quarter default, missing-BN ✦ card); receipt import kept (#309). **Deferred:** wizard internals repaint, ledger CSV endpoint. ✅-gate (live design-critique) pending |
| Customer Documents | ✅ | ✅ `od-customer-documents` | 0 (build `1f5cd745` ✅) | 🟡 #308 | shared `<CustomerDocument>` shell built (#308: estimate adopts it; reusable for CO `/approve`) + invoice pay surface rebuilt (Stripe + Interac parity, province-aware GST, additive id→code keying). **Deferred:** security card (rate-limit/token on no-login PII pages). ✅-gate (live design-critique) pending |
| Settings (config hub · 30 sub-pages) | ✅ `settings.md` | ✅ `od-settings` | 0 (build `5aaf0e1d` ✅) | 🟡 #314 | role-filtered nav (centralized `ROLE_HIDDEN_HREFS`; member matrix Ops-confirmed incl. Audit kept; admin = flagged default) + `OwnerOnlyPane` on gated routes + Paper shell + foot counts (owner 26/27 · member 21/27 · admin 23/27) + mobile grouped-card list (#314). **Deferred:** settings search; heavy sub-flows (Team/Billing/QuickBooks/Import) graduate to own renders; per-form redesigns cascade via primitives. ✅-gate (live design-critique) pending |
| Settings ▸ Team (`/settings/team`) | ✅ `settings-team.md` | ✅ `od-settings-team` | 1 (restyle ✅ #324; **backend blocked on Ops**) | 🟡 #324 | restyle built (#324): two-region Crew + Crew defaults · role-led "Add to crew" (existing invite action) · collapsed + gated pay/charge (**margin OWNER-only**) · ✦ read-only roster signals (GST# missing) · no-seat guardrail · 4 orphaned components removed. **⛔ Deferred — needs Ops decision + migration (not built; disabled "coming soon"):** inline role-change (`updateMemberRoleAction` + `tenant_members` UPDATE RLS + per-role matrix) · soft-deactivate (`deactivateMemberAction` + schema flag) · admin-invite (`worker_invites` CHECK widen). **Recommend splitting these into their own card.** ✅-gate pending |
| Settings ▸ Billing (`/settings/billing`) | ✅ `settings-billing.md` | ✅ `od-settings-billing` | 1 (build `51c3f088`) | 🟡 (live, pre-redesign) | graduated from Settings (the GC's OWN HeyHenry subscription — NOT customer AR, NOT Stripe Connect); render converged (1-round OD loop); Paper restyle of 5 cards · **state-first cockpit** (status-tokens; past-due needs-action) · **grandfather-honest** founding-rate chip + ✦ Change-plan guard · **seat-silent** (flat $/mo, no seatBand) · cancel two-step preserved (refund preview + non-coercive pause + exit survey, **no retention discount**) · GST receipt column · **card-only (no Interac)**. **Coding follow-ups: wire `?upgrade` + mount trial/past-due banners · remove `seatBand` · owner-only-vs-admin Ops confirm** |
| Settings ▸ QuickBooks (`/settings/quickbooks` +3 routes) | ✅ `settings-quickbooks.md` | ✅ `od-settings-quickbooks` | 1 (build `22bcc075`) | 🟡 (live, pre-redesign) | graduated from Settings (one integration, 4 routes); render converged (1-round, scoped: hub across 4 states + class-mapping; review/history via cards); **import-only boundary stated** ("QBO is your books · nothing writes back · push coming") · status-tokens (`qboSyncStatusTone`, no raw emerald/amber) · connection cockpit + "Needs you" line + sandbox flag · Import promoted to primary + live job panel · sub-route cards (live counts) · **Class→Project** mapping (not categories) + Overwrite consequence control + ✦ suggestion (never auto-applies) · Intuit Connect button · sync_log failures surfaced. **Coding follow-ups: live-count fan-out · `qboSyncStatusTone` · tenant-tz · owner-only connect/disconnect** |
| Settings ▸ Import / Export (`/import` · `/settings/imports` · `/settings/data-export`) | ✅ `settings-import.md` | ✅ `od-settings-import` | 1 (build `7e920df8`) | 🟡 (live, pre-redesign) | graduated from Settings; render converged (1-round; 4 surfaces — hub + text wizard (INPUT/PREVIEW/DONE) + file-pile wizard (INPUT+PROCESSING/PREVIEW) + imports/rollback list + PIPEDA export); **Henry-classify-any-shape — NO column-mapping step** (the showcase) · ✦ Read it · decision table (Create/Merge/Skip; dedup Match = rules-based, not ✦) · rollback safety net (soft-delete) · frozen historical tax on imports · export owner+MFA. **Coding follow-ups: column-mapping decision · extract shared `DecisionToggle` · invoice StatusPill → status-tokens · IA consolidation** |
| Onboarding (first-run) | ✅ `onboarding.md` | ⬜ | — | ⬜ (no setup step today) | **Code truth: `(auth)/onboarding` doesn't exist** — signup → `/dashboard`, no business-profile step. Brief = a NEW light / skippable / resumable first-run pass (logo · GST/WCB · province · "meet Henry"); flat-rate plan-picker (no per-seat); mobile-first. Lower urgency (no firm launch date). |
| Referrals (growth) | ✅ `referrals.md` | ⬜ | — | 🟡 (built, pre-Paper) | built/live → repaint + calm-down + `status-tokens`. ⚠ **reward state is vaporware** (`rewards:0` hard-coded; nothing converts) — don't design a V1 earnings state; reward+payout pipeline graduates. `/r/[code]` public landing owned here (deferred from `public-pages.md`). V1.1-candidate. |

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
| Photos / Documents / Notes | ✅ `project-secondary-tabs.md` | ✅ `od-secondary-tabs` | 0 (build `17401e13` ✅) | 🟡 #316 | built (#316): `VisibilityBadge` label+glyph (Internal/Client-visible, never colour-only) on photos+docs · COI-internal + expiry · Ask-Henry-as-action (drops to feed, not chat) + internal-only banner · Henry suggest-confirm photo tags · Paper restyle · IndexedDB offline-capture queue (open-tab sync; **closed-tab SW Background Sync = follow-up**). Home Record = entry-point only (own render). ✅-gate (live design-critique) pending |
| Home Record (`/home-record/[slug]` + closeout flow) | ✅ `home-record.md` | ✅ `od-home-record` (operator + artifact) | 0 (build `26aa6be1` ✅) | 🟡 #325 | built (#325): **A** operator 3-step state strip + readiness chips + one Regenerate (AlertDialog) + preview drawer w/ **✦ Henry closeout-summary editor** + email-to-client dialog; **B** public artifact on `<CustomerDocument>` letterhead (summary plain prose, behind-the-wall section, server-only, branded 404). Additive migration freezes Henry summary in snapshot; email→`renderEmailShell`. **Boundary orchestrator-verified** (no margin/cost/supplier-cost; ✦ invisible client-side; no authed helper on public route). **Deferred:** stale-format guard (needs `*_built_at` 2nd migration); verify gateway `closeout_summary` task at runtime. ✅-gate pending |
| Selections (per-room finishes) | ✅ `selections.md` | ✅ `od-selections` | 0 (build `97627958` ✅) | 🟡 #317 | built (#317): allowance-vs-actual variance (`lib/selections/variance.ts` + room/project roll-ups, label+glyph) · over-allowance "Start CO" + Henry nudge **wired to the real CO route** (prefilled title/reason; operator authors lines) · dual-authoring by-tags · idea→selection one-way (distinct objects) · client portal view (no margin/supplier/SKU/CO). **Notes:** local (non-persisted) nudge dismiss; no deeper CO line-prefill. ✅-gate (live design-critique) pending |

### Worker & public surfaces (separate route groups)
| Surface | Brief | OD render | Open dev cards | Built (ref) | Notes |
|---|---|---|---|---|---|
| Worker app `/w` (mobile field surface) | ✅ `worker-app.md` | ✅ `od-worker-app` | 0 (build `6322a4d7` ✅) | 🟡 #318 | built (#318): bottom-nav 8→**4 primary + raised Log FAB**; field-hardened Paper (64px nav/FAB, 48/52px targets); Today cockpit + gated sub-billing nudge; **offline time-queue** (IndexedDB, "saved will sync", reconnect-flush); capability-gated expense/invoice; worker boundary intact. **Deferred:** offline for expense-blob + invoice submit + closed-tab SW sync; heavy capture flows (own renders). ✅-gate (live design-critique) pending |
| Public pages (`/portal`, `/estimate`, `/approve`, `/decide`, `/view`, `/pulse`, `/home-record`) | ✅ `public-pages.md` | ✅ `od-public-pages` | 0 (build `f1f04673` ✅) | 🟡 #319 | built (#319): `<PublicBrandHeader>` letterhead · portal hub restyle (intentional order, bottom-sheet tabs, **calm non-enumerating boundary copy**) · tap-to-decide on the branded shell. Approval family + `customer_view_mode` GC-only lever already on `<CustomerDocument>` (#308/#310/#315). **Boundary audited** (orchestrator-verified: no new field surfaced, no authed-helper on public routes, filters intact). **Graduated:** Home Record · Pulse · Showcase · `/q` `/r`. ✅-gate (live design-critique) pending |

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

**Onboarding + Referrals — now briefed ✅** (2026-05-23, closing the last GC gaps):
- **Onboarding** → `onboarding.md` — a NEW light first-run setup pass (`(auth)/onboarding` doesn't exist today; signup → `/dashboard`). Lower build urgency (no firm launch date).
- **Referrals** → `referrals.md` — built/live → repaint; the reward/payout pipeline is vaporware (flagged, graduates). V1.1-candidate.

**Out of redesign scope (intentionally not briefed):**
- **Bookkeeper portal** (`/bk`) — deferred (see the sweep note above; Role Matrix `03b1ccf4` / Workflow #8).
- **`admin`** (internal ops UI) · **`social`** (ops marketing drafts) · **`lead-gen` + `leads`** (PW-vertical public lead capture; GC leads = Contacts) · **legacy `jobs` + PW quotes** (`quotes.md` maps the PW→GC boundary; GC uses Projects).
- **Owner Dashboard** (`dashboard.md`) — owner optimizes on a separate track ("don't touch").

**Net:** **every GC-V1 redesign surface is now briefed — zero in-scope gaps.** Remaining work is downstream per screen (OD render → build → the ✅-verify gate) plus the explicitly out-of-scope set above (Bookkeeper `/bk`, `admin`, `social`, `lead-gen`/`leads`, legacy `jobs`/PW quotes, owner Dashboard).

## Cross-cutting items
- **"client" not "homeowner" terminology sweep** — Ops decision `1d055427`; dev card `2eab19b2` (12 briefs + sacred-path + vault Role × Object Matrix `03b1ccf4` + the 2 design skills). Folded into the reconciliation pass. Keep "customer" for data/product terms.
- **OD→build contract:** `docs/ux/HANDOFF-TO-BUILD.md` (tokens + class names + data bindings so builds don't drift from screenshots).
- **Subscreen-inventory backfill — ✅ COMPLETE** (2026-05-23) across all 13 briefed screens (Schedule · Client · Overview · Estimate · Change-Order · Invoices · Contacts · Expenses · Calendar · Projects-list · Inbox · Customer-Documents · Project-Hub) — each brief now carries a `## Subscreen inventory`. **Graduates — both handled:** `/invoices/[id]` now has its own brief + row (`invoice-detail.md`); the `<CustomerDocument>` shared shell is specced in `customer-documents.md` (render `od-customer-documents` + build card `1f5cd745`) — a shared-component (PATTERNS) extraction, not a separate brief. New screens get their inventory inline via the skill's Subscreen-Inventory step.
- **Mobile audit sweep** (cross-cutting — run per build-batch; **NOT a standing lane**): drive the live app (`app.heyhenry.io`, tenant **Maple Ridge Renos** / `gcdemo@example.com`) at phone widths. Check the **app-wide** mobile patterns once — nav collapse (`<select>`) · worker `/w` bottom-nav · ≥44px tap targets · safe areas · sticky bars · overflow/clipping · capture-first flows — plus each built screen against its brief's "Mobile vs desktop" section; file Dev cards for findings. Emulated-mobile (narrow viewport via the Chrome MCP) catches layout / spec / tap-target / overflow drift; a human on-device spot-check stays for true touch / iOS-Safari / perf.

---

## How to update this doc
When you finish your stage for a screen: flip the cell (⬜→🟡→✅), add the ref (commit/card/render path), and commit `PIPELINE.md` alongside your work. If you discover a cell is wrong, fix it — it's only useful if it's true. **Subscreens count:** a screen isn't fully designed until its Subscreen Inventory is done (skill step 8) — track it in the row's Notes (e.g. `subscreens: 🟡 3/6 specced`), and don't mark a screen ✅ Built+Verified with un-specced heavy subscreens. Foundation docs + skills: `docs/ux/HANDOFF.md`, `docs/ux/README.md`, `.claude/skills/heyhenry-*`.
