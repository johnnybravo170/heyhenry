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
| Projects list | ✅ | ✅ `od-projects-list` | — | ✅ #277 | ⚠ **New-project *creation* screen is being rebuilt in Coding (2026-05-26).** `/projects/new` (`new-project-page.tsx` · `project-form.tsx` · `intake-accelerator.tsx`). Any notes/render touching project *creation* (this row · `projects-list.md` · `project-hub.md` · `od-projects-list`) may be **stale** — reconcile against the live build before acting. |
| Inbox | ✅ | ✅ `od-inbox-triage` | — | 🟡 ? | build state unconfirmed |
| Billing / AR (cross-project) | ✅ `invoices.md` | ✅ `od-billing` | — | ✅ #288 | |
| Invoice detail (`/invoices/[id]`) | ✅ `invoice-detail.md` | ✅ `od-invoice-detail` | 0 (build `6b0f6cfc` ✅) | ✅ #315 | ✅-gate passed 2026-06-01: INV code + status badge 11px ✓ · GST (5%, included) ✓ · "Awaiting payment" strip ✓ · GST/HST missing warning with inline CTA ✓ · Document details disclosure ✓ · action bar (Resend/Record payment/Void/Print). **P2 residual (mobile):** "Record payment" CTA ~1000px below fold — primary job buried; consider sticky action bar on mobile. |
| Business Health (owner money cockpit) | ✅ `business-health.md` | ✅ `od-business-health` | 0 (build `ca55937c` ✅) | ✅ #313 | ✅-gate passed 2026-06-01: net-cash + AR aging hero ✓ · FY date-range picker ✓ · Revenue/Owner-pay/Expenses KPI row ✓ · owner-draws ledger ✓ · Paper palette ✓. |
| Bank reconciliation (`/business-health/bank-*`) | ✅ `bank-reconciliation.md` | ✅ `od-bank-reconciliation` | 0 (build `d220e940` ✅) | ✅ #320 | ✅-gate passed 2026-06-01 (empty-state pass — no statement imported in QA tenant). "Import a bank statement" CTA clear · filter tabs ✓. Render-fidelity pass deferred to when a real statement is loaded. |
| Calendar (crew scheduling) | ✅ `calendar.md` | 🟡 (no `od-calendar` dir) | — | ✅ #270–#275 | built ahead of a formal OD render |
| Estimate (Budget authoring) | ✅ | ✅ (project-hub budget) | — | ✅ #278/#281 | |
| Quotes (PW sales-quote object) | ✅ `quotes.md` | ⬜ (PW-only) | — | ✅ (PW live) | **PW-vertical** — GC `/quotes`→`/projects`; GC quoting = `estimate.md` + project Budget + `/approve*`. Brief = map + scope boundary; **recommend no GC render**. Open: auto-create-Project-on-approval decision |
| Change Order | ✅ | ✅ `od-change-order` | 0 (build `01a46861` ✅; voice/photo deferred) | ✅ #310 | ✅-gate passed 2026-06-01 (create-form pass — no existing CO in QA tenant). CO create form: Paper palette ✓ · title/notes/nearest-date/timeline-impact/management-fee-toggle ✓. Diff editor view not reached (needs an existing CO). **Deferred:** voice/photo drafting; `approved_unbilled_co` Overview rule; diff editor ✅-verify on a real CO. |
| Expenses | ✅ | ✅ `od-expenses` | 0 (build `d681c249` ✅) | ✅ #309 | ✅-gate passed 2026-06-01 (empty-state pass). Receipt drop-zone + Henry reads label ✓ · Log expense CTA ✓. Wizard internals repaint deferred per brief. |
| Customer Documents | ✅ | ✅ `od-customer-documents` | 0 (build `1f5cd745` ✅) | 🟡 #308 | shared `<CustomerDocument>` shell built (#308: estimate adopts it; reusable for CO `/approve`) + invoice pay surface rebuilt (Stripe + Interac parity, province-aware GST, additive id→code keying). **Deferred:** security card (rate-limit/token on no-login PII pages). ✅-gate pending — reachable only via customer-facing URL (needs real portal/invoice link to verify the public shell). |
| Settings (config hub · 30 sub-pages) | ✅ `settings.md` | ✅ `od-settings` | 0 (build `5aaf0e1d` ✅) | ✅ #314 | ✅-gate passed 2026-06-01: role-filtered nav 26 items (owner) ✓ · Paper shell ✓ · Business profile form ✓. Mobile grouped-card list not verified (desktop-only pass). |
| Settings ▸ Team (`/settings/team`) | ✅ `settings-team.md` | ✅ `od-settings-team` | 1 (restyle ✅ #324; **backend blocked on Ops**) | ✅ #324 | ✅-gate passed 2026-06-01: two-region Crew + Crew defaults ✓ · "Add to crew" action ✓ · Role-change/deactivate disabled "Coming soon" ✓ · GST# missing ✦ signal ✓. **⛔ Deferred (backend-blocked):** inline role-change · soft-deactivate · admin-invite. |
| Settings ▸ Billing (`/settings/billing`) | ✅ `settings-billing.md` | ✅ `od-settings-billing` | 0 (build `51c3f088` ✅) | ✅ #326 | ✅-gate passed 2026-06-01: "No active subscription" state + "Choose a plan →" CTA ✓ · Paper shell ✓ (demo tenant has no subscription — expected). |
| Settings ▸ QuickBooks (`/settings/quickbooks` +3 routes) | ✅ `settings-quickbooks.md` | ✅ `od-settings-quickbooks` | 0 (build `22bcc075` ✅) | ✅ #327 | ✅-gate passed 2026-06-01: import-only boundary stated ✓ · "Connect to QuickBooks" (Intuit green button) ✓. |
| Settings ▸ Import / Export (`/import` · `/settings/imports` · `/settings/data-export`) | ✅ `settings-import.md` | ✅ `od-settings-import` | 0 (build `7e920df8` ✅) | ✅ #329 | ✅-gate passed 2026-06-01: Day-1 hub with 6 import-type cards ✓ · Henry AI reads description ✓ · "Start here" recommended-next ✓. |
| Onboarding (first-run) | ✅ `onboarding.md` | ✅ `od-onboarding` | 0 (build `4d949a98` ✅) | 🟡 #330 | net-new built (#330): `(auth)/onboarding` step shell (Vertical → Business profile → Meet Henry orientation). ✅-gate pending — cannot reach via QA owner account (existing tenants backfilled complete; need fresh signup to verify). |
| Referrals (growth) | ✅ `referrals.md` | ✅ `od-referrals` | 0 (build `7783050e` ✅) | ✅ #331 | ✅-gate passed 2026-06-01: share link + Copy/Share/Invite ✓ · honest reward state ("Coming" tile, $200 CAD chip) ✓ · Paper palette ✓. |
| Team checklists (`/checklists`) | ✅ `checklists.md` | ✅ `od-checklists` | 1 (build `71b8d677`) | 🟡 (live, pre-redesign) | cross-project crew-list rollup (`project_checklist_items`, **GC-native on `projects`**); embeds `TeamChecklist` (worker Today + hub + dashboard chip). Target: Paper restyle + **Tasks-vs-Checklist clarity**. QA-caught gap. **Rendered R1→R2 (`od-checklists/screens/{desktop,mobile}.html`):** crew rollup (per-project cards + embedded bare `TeamChecklist` · "{n} open" chips · add row w/ category+photo · checkboxes · completed cross-off) · type-clean · status-token chips · ink primaries + rust accent. **Decisions (Jonathan, 2026-05-26): (1) strengthen clarity — "CREW LIST" eyebrow + "not your Tasks/Todos" helper; (2) keep the top-nav slot.** Build → `71b8d677`. |

### Project Hub (shell + tabs)
| Tab | Brief | OD render | Open dev cards | Built (ref) | Notes |
|---|---|---|---|---|---|
| Hub shell (header/nav) | ✅ `project-hub.md` | ✅ `od-project-hub` | — | ✅ #268/#287 | |
| Overview | ✅ `overview.md` | ⚠ `desktop.html` **STALE** | **1** (calm-type `614a3b9a`) | 🟡 #268/#301/#306 | aggregator engine + Paper restyle (#301); `schedule_slip` rule wired (#304); 3-layer badge consistency (#306). **Only outstanding:** `ready_to_bill` rule. ✅-gate pending (card `614a3b9a` must ship first). **2026-06-01 live inspection confirmed:** KPI hero numbers at 18px (should be `text-display-sm` 24px) · cents showing in StatBox summary (`$96,996.00` — whole-dollar mode needed). Both are exactly what `614a3b9a` fixes — ✅-gate gate blocked until that card ships. · **⚠ OD render STALE** (predates current StatBox cockpit). |
| Budget | ✅ (project-hub) | ✅ `…-budget` (refined) | 4 (refine `ab8bf666` · est-preview `e64a8d31` · format `7cd54022` · distributed `da5bd4a0`) | ✅ #278/#281 | **Refinement pass — render refreshed (`desktop/mobile-budget.html`):** nesting legibility (hover-reveal handle + left guide-rail + lighter line rows + contained-well shading, 3 weights) · split add-flow (minimal Add-section vs fuller Add-category + contextual "+Add category" + styled inline-form Paper card + header) · expand-all toggle · client-estimate footer (eyebrow + Copy-link/Preview&share → "Preview & send" + status-aware primary). **Estimate-preview fixes** (detail-ladder Detailed↔Categories reads inverted · translucent send-bar bleed-through · missing scope-summary editor) → `e64a8d31`. **Format-fidelity re-render** (`desktop-budget.html` regenerated — keep the built layout exactly, fix only the build's formatting drift: type scale 16/14/12 + 11px-mono · de-emph-cents tabular money · one mono-label tracking/tone · even well rhythm · rust-only accent · clean demo copy; verified type-clean + faithful to current source incl. smart Collapse/Expand toggle + `Subs + open POs` sub-label) → `7cd54022`. **Distributed-contrast pass — canonical render replaced (`desktop-budget.html` is now the v3 spec):** status-aware progress bars (green/amber/red — rust OFF the bars, kept for action only); de-black-holed the expanded line-item area (3 surface levels — section band warm / line rows lighter / spend-detail well indented + faint tint + left connector rail clearly subordinate to its parent line); line-name semibold ink as the row anchor; calm white summary card (no coloured hero panel); column headers re-anchored inside expanded regions; muted "—" placeholders; quieter variance flags (count copy, soft-pair tone); readable de-emph cents (`~0.8em`); subtle source-tint pills. Approved by Jonathan after R3 in Chrome. **Live build → `da5bd4a0` (supersedes `61a6346f`).** |
| Spend | ✅ (project-hub) | ✅ `…-spend` | — | ✅ #290/#291/#298 | |
| Labour | ✅ (project-hub) | ✅ `…-labour` | — | ✅ #294 | |
| Schedule | ✅ `schedule.md` | ✅ `…-schedule` | **0** (refinements only) | ✅ #295/#303/#304/#305 | ✅-gate passed 2026-06-01 (empty-state pass — no schedule built yet). 3 entry-point cards (Apply template / Build from budget / Start blank) ✓ · Project start date ✓ · Paper palette ✓. **Refinements outstanding:** CO→schedule inline prompt (needs card) + mobile-Timeline variant. |
| Billing (project) | 🟡 (project-hub §Billing; no standalone) | ✅ `…-billing` | — | ✅ #296 | dedicated brief intentionally skipped |
| **Client** | ✅ `client.md` | ✅ `…-client` | **1** (Pulse pt1) | ✅ #302 | ✅-gate passed 2026-06-01: Messages sub-tab ✓ · "Portal is off" banner + "Set it up" CTA ✓ · Selections + Portal & Updates sub-tabs ✓. **Outstanding:** Pulse pt1 card `b9bb93b7`. |
| Photos / Documents / Notes | ✅ `project-secondary-tabs.md` | ✅ `od-secondary-tabs` | 0 (build `17401e13` ✅) | ✅ #316 | ✅-gate passed 2026-06-01: upload zone + Henry tags label ✓ · "TAKE PHOTO" sub-tab ✓ · empty state ✓. **Note:** URL param is `?tab=gallery` (not `?tab=photos`); nav link correctly uses `gallery`. Raw `?tab=photos` silently renders blank — low severity (no user path uses it). |
| Home Record (`/home-record/[slug]` + closeout flow) | ✅ `home-record.md` | ✅ `od-home-record` (operator + artifact) | 0 (build `26aa6be1` ✅) | 🟡 #325 | ✅-gate pending — not reachable in QA tenant (home record gated to project completion; QA project has no closeout state). Needs a completed project to verify. |
| Selections (per-room finishes) | ✅ `selections.md` | ✅ `od-selections` | 0 (build `97627958` ✅) | ✅ #317 | ✅-gate passed 2026-06-01 (empty-state pass). "No selections yet" + "Add selection" CTA ✓ · sub-tabs ✓ · Portal-off notice ✓. |

### Worker & public surfaces (separate route groups)
| Surface | Brief | OD render | Open dev cards | Built (ref) | Notes |
|---|---|---|---|---|---|
| Auth / sign-in (`(auth)`) | ✅ `auth.md` | ✅ `od-auth` | 1 (build `93fa1e10`) | 🟡 (live, pre-redesign) | login · magic-link · check-email · MFA(+recover) · signup · worker `join/[code]`; **never pipeline'd before (QA-caught gap).** Target: Paper restyle + **password-vs-magic-link product call** + mobile-first; role-routing spine (owner/admin/member→/dashboard, worker→/w, bookkeeper→/bk); onboarding handoff → `onboarding.md`. Preserve rate-limit/no-enumeration/MFA. **Rendered R1→R2 (`od-auth/screens/{mobile,desktop}.html`):** Paper restyle of all 5 surfaces (login · check-email · signup · MFA · worker-join) — banners→status-tokens · defined fields · ink primaries + rust accent-only · type-clean (closed scale held). **Product call (Jonathan, 2026-05-26): magic-link CO-EQUAL on login** (password default + "— or —" + ink-outline "Email me a sign-in link"; signup stays password-only). Build → `93fa1e10`. |
| Worker app `/w` (mobile field surface) | ✅ `worker-app.md` | ✅ `od-worker-app` | 0 (build `6322a4d7` ✅) | 🟡 #318 | ✅-gate pending — `gcdemo+worker@example.com` login failed locally (account may not exist on prod Supabase; `setup-gc-demo-tenant.mjs` may need a re-run). Needs worker-role login to verify `/w` route group. |
| Public pages (`/portal`, `/estimate`, `/approve`, `/decide`, `/view`, `/pulse`, `/home-record`) | ✅ `public-pages.md` | ✅ `od-public-pages` | 0 (build `f1f04673` ✅) | 🟡 #319 | ✅-gate partial 2026-06-01: `/portal/[slug]` preview mode verified — `<PublicBrandHeader>` letterhead ✓ · Preview mode banner ✓ · Project status at-a-glance ✓ · progress bar ✓ · bottom mobile nav ✓. **⚠ Portal status pills off-spec:** using raw `rounded-full bg-blue-100 px-2.5` at 12px (not `<StatusBadge>` — filed as dev card `portal-pills`). Other public routes (`/estimate`, `/approve`, `/view`) not verified (need real token-bearing links). |
| Closeout gallery share (`/g/[handle]`) | ✅ `gallery-share.md` | ✅ `od-gallery-share` | 1 (build `12472a53`) | 🟡 (live, pre-redesign) | token-gated public job-photo gallery + review/referral CTA; **job-keyed (PW) — the GC-on-`projects` path is the open scope Q**; adopt `<PublicBrandHeader>` (raw `neutral-*` today); internal tags stripped server-side. QA-caught gap. **Rendered R1→R2 (`od-gallery-share/screens/{mobile,desktop}.html`):** client gallery on `<PublicBrandHeader>` (tag-grouped grid · trust line · prominent Review CTA = the one rust · branded empty + 404/revoked) + operator share/govern strip · type-clean · boundary intact (HIDDEN_TAGS stripped). **Decisions (Jonathan, 2026-05-26): (1) GC closeout sharing routes via portal + Property Record — `/g/` stays job-keyed/PW, no projects-keyed path; (2) keep "via Hey Henry" attribution on by default.** Build → `12472a53`. |

---

## Untouched screens — menu for the next research pass
> ✅ **Sweep complete — `research-0523` (2026-05-23) briefed every actionable screen on this menu.** Promoted into the tables above with briefs: **Business Health** (`business-health.md`), **Quotes** (`quotes.md`), **Settings** (`settings.md`), **Project secondary tabs / Photos·Documents·Notes** (`project-secondary-tabs.md`), **Worker app `/w`** (`worker-app.md`), **Public pages** (`public-pages.md`). The only remaining item is intentionally deferred:

- **Bookkeeper portal** (`/bk`) — **deferred, out of redesign scope for V1 — confirmed by the sweep.** Real + shipped, but scoped out by Role × Object Matrix `03b1ccf4` (`/bk` financial-only, "out of redesign scope"), Object Model `b4d880be` (Bookkeeper-domain tables out of scope), and Workflow Library `e0263cc3` (#8 Bookkeeper Review — deferred, separate portal). Revisit only if it re-enters scope.

**Gaps surfaced (during + after the sweep) — all addressed:**
- **Project → Selections tab** — found un-briefed during the sweep, **now briefed** (`selections.md`, 2026-05-23) and promoted into the Project Hub table above.
- **Auth / sign-in (`(auth)`)** — the login front door was never on the menu *or* in the scope ledger; caught in QA (2026-05-23). **Now briefed** (`auth.md`) and promoted into the Worker & public surfaces table. (Onboarding/post-signup was already briefed; this covers login · magic-link · MFA · signup · worker-join.)
- **Closeout gallery share (`/g/[handle]`)** + **Team checklists (`/checklists`)** — surfaced by a **full route-by-route audit** (every `page.tsx` diffed against briefs, 2026-05-26) after the auth miss. Both **now briefed** (`gallery-share.md`, `checklists.md`) and promoted above. The audit reconciled all ~140 routes — see the scope-ledger Net line.

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

**Net (audit-backed, 2026-05-26):** a **full route-by-route audit** — every `page.tsx` (~140 routes) diffed against the briefs — is now reconciled. **Every in-scope screen is briefed**, including the three the menu-only sweep missed (`auth.md`, `gallery-share.md` `/g/[handle]`, `checklists.md`); everything else is **explicitly out-of-scope** (Bookkeeper `/bk`, `admin`, `social`, `lead-gen`/`leads`, legacy `jobs`/PW quotes, owner Dashboard, root placeholder + static legal). *(Lesson: the "zero gaps" claim was made twice off the menu/ledger before a full route walk caught auth + these two — completeness claims now require the route audit, not the ledger.)* Remaining work is downstream per screen (OD render → build → the ✅-verify gate). **Borderline — RESOLVED (verified covered; no brief needed, 2026-05-26):** `/todos` → same component/data as the Inbox **Todos** tab (`inbox.md`); standalone route + dashboard-command-center entry · `/share` → the Web-Share-Target picker that forwards into **Intake** (now named in `inbox.md` subscreens) · `account/deletion-pending` → post-action state of the Settings **account-delete** flow (`settings.md`) · the **6 `*/import`** wizards (`contacts|projects|invoices|expenses|photos|time`) → fully enumerated in `settings-import.md`. **No new briefs — loop closed.**

## Cross-cutting items
- **"client" not "homeowner" terminology sweep** — Ops decision `1d055427`; dev card `2eab19b2` (12 briefs + sacred-path + vault Role × Object Matrix `03b1ccf4` + the 2 design skills). Folded into the reconciliation pass. Keep "customer" for data/product terms.
- **OD→build contract:** `docs/ux/HANDOFF-TO-BUILD.md` (tokens + class names + data bindings so builds don't drift from screenshots).
- **Subscreen-inventory backfill — ✅ COMPLETE** (2026-05-23) across all 13 briefed screens (Schedule · Client · Overview · Estimate · Change-Order · Invoices · Contacts · Expenses · Calendar · Projects-list · Inbox · Customer-Documents · Project-Hub) — each brief now carries a `## Subscreen inventory`. **Graduates — both handled:** `/invoices/[id]` now has its own brief + row (`invoice-detail.md`); the `<CustomerDocument>` shared shell is specced in `customer-documents.md` (render `od-customer-documents` + build card `1f5cd745`) — a shared-component (PATTERNS) extraction, not a separate brief. New screens get their inventory inline via the skill's Subscreen-Inventory step.
- **Mobile audit sweep** (cross-cutting — run per build-batch; **NOT a standing lane**): drive the live app (`app.heyhenry.io`, tenant **Maple Ridge Renos** / `gcdemo@example.com`) at phone widths. Check the **app-wide** mobile patterns once — nav collapse (`<select>`) · worker `/w` bottom-nav · ≥44px tap targets · safe areas · sticky bars · overflow/clipping · capture-first flows — plus each built screen against its brief's "Mobile vs desktop" section; file Dev cards for findings. Emulated-mobile (narrow viewport via the Chrome MCP) catches layout / spec / tap-target / overflow drift; a human on-device spot-check stays for true touch / iOS-Safari / perf.
- **Forms — cross-cutting Paper pass** (`forms.md`, 2026-05-23): the redesign restyled screen *chrome* but **not the forms/dialogs inside** — they're pre-Paper app-wide (low-contrast fields, ink-not-rust primary). **Root cause is shared primitives** (`ui/input` `bg-transparent` + warm-on-warm `--input` border; default `<Button>` ink), so **one primitive/token PR propagates to all ~40 forms** + a light per-form follow-up. This is the bulk of the "looks untouched" surface a manual click-through finds. **Recommended Dev card:** "Form-field definition + button-hierarchy primitive repaint (app-wide)."

---

## How to update this doc
When you finish your stage for a screen: flip the cell (⬜→🟡→✅), add the ref (commit/card/render path), and commit `PIPELINE.md` alongside your work. If you discover a cell is wrong, fix it — it's only useful if it's true. **Subscreens count:** a screen isn't fully designed until its Subscreen Inventory is done (skill step 8) — track it in the row's Notes (e.g. `subscreens: 🟡 3/6 specced`), and don't mark a screen ✅ Built+Verified with un-specced heavy subscreens. Foundation docs + skills: `docs/ux/HANDOFF.md`, `docs/ux/README.md`, `.claude/skills/heyhenry-*`.
