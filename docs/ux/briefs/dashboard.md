# OD Brief — Owner Dashboard (cockpit)

> **Grounded in:** `src/app/(dashboard)/dashboard/page.tsx` + `_sections/{attention,jobs,pipeline,metrics}-section.tsx`, `command-center.tsx`, `needs-attention.tsx`, `money-at-risk-card.tsx`, `key-metrics.tsx`, `renovation-pipeline-summary.tsx`, `recent-activity.tsx`, `estimate-celebration-card.tsx`, `first-run-hero.tsx`, `lib/db/queries/dashboard.ts` (`getKeyMetrics` / `getRenovationPipelineMetrics` / `getAttentionItems` / `getRevenueYtd`) + `money-at-risk.ts` + `tasks.ts` (buckets). **How to use:** paste into the OD project (deepened "Paper" palette + the typographic-clarity discipline in DESIGN.md), generate hi-fi desktop + mobile, then run `heyhenry-design-critique`.
> **Current vs. target:** today the dashboard *leads with action* (good) but then stacks **two redundant metric rows** (Pipeline + KeyMetrics duplicate "Active" and "Awaiting approval"), independently-computed money numbers, a long audit feed, and "coming soon" placeholders — plus several **non-reno (PW-carryover) branches**. This brief specifies the **target**: GC-only, action-first, ruthless cut to *usable* info — every item appears **exactly once**, a single Henry orientation line (no duplicating digest), and **no standing number tiles** (the dashboard triages + launches; the numbers each live on their dedicated home — Business Health, Billing, Projects). **A dashboard is all usable info, not a smatter of whatever's available — and never the same thing twice.**

**Object:** the business at a glance · **Roles:** owner / admin (crew → the separate worker dashboard; homeowner → portal) · **Primary action:** "what needs me right now" → act / launch into the work

## Purpose
The owner's home cockpit: in two seconds, *what needs me today*. Every element earns its place by prompting an action, and **each item lives in exactly one place**. Standing metrics live on their dedicated screens (Business Health / Billing / Projects) — the dashboard triages and launches, it doesn't re-display numbers or repeat itself.

## Remove first — all non-reno / PW carryovers *(GC-only now)*
- **`TodaysJobs`** (`showTodaysJobs = !isRenovation`) — gone.
- **Job task health** (`getJobTaskHealth`, CommandCenter `showJobHealth`) — gone.
- **Generic `PipelineSummary` / `getPipelineMetrics`** (non-reno) — gone; keep only the renovation pipeline.
- **Collapse all `isRenovation` branching** — the renovation/GC path is the *only* path. No service-vertical conditionals.
- All **"coming soon"** placeholders ("Schedule risks…", "Henry suggestions…") — gone (Henry is now a one-line read + intelligence embedded in the cards, below).
- **All standing metric tiles** — the Pipeline funnel *and* the KeyMetrics money tiles (Revenue / Outstanding). See "No standing numbers" below.
- **The multi-line "Henry briefing" digest** — a card that *lists* items also shown below is duplication. Replaced by the one-line read + embedded intelligence (below).

## Layout (top → bottom — action first, then status, then audit)
1. **Header + Henry's one-line read** — logo + greeting, then a single **Henry orientation line**: a count + read of the day — *"3 things need you today"*, or on a clear day *"Nothing needs you — you're caught up."* It **orients; it does not enumerate** — it never lists Patel / Lin / Graham, because those live in the cards below. ✦ HENRY voice; the accent reflects state (rust when something needs you, calm green when all-clear). **The count = the "Needs You" decision count** (verify + change-orders + client decisions — the things only the owner can resolve), so "N things need you today" reconciles exactly with the Needs-You card. Never a number that maps to nothing on screen.
2. **Celebration — the wins surface** *(event-triggered; "when warranted")* — a genuine win lands here, once: estimate accepted, invoice paid (especially an overdue one finally landing), project completed, milestone hit. Carries the delight **+ the natural next action** ("Graham accepted Bathroom Upgrade → Open the project"). Only appears when there's a real win — quiet days show none. **The win lives here only — never *also* as a header/briefing line.**
3. **The action zone** (the kept command center — focused), each item appearing **once**:
   - **Needs You:** tasks to **verify**, pending **change orders** to approve, client decisions. Each one-tap actionable.
   - **Today:** due-today + overdue tasks (`dueToday` + `overdue` buckets).
   - **Blocked:** blocked tasks grouped by reason (Client / Material / Sub) so the owner knows *who to chase to unblock*.
4. **Needs Attention — one prioritized chase list** *(consolidate — kills the money-shown-thrice problem)*: merge **NeedsAttention** (overdue calls/follow-ups, stale quotes, overdue invoices) **+ Money-at-risk** into a single ranked list — money first (overdue/at-risk invoices, with the AR-engine-escalated ones flagged *"Henry chased · no reply → you call"* and the "I called them" dismiss preserved), then stale quotes, then **aging estimates** (a sent estimate in *awaiting approval* past N days — "Lin Family · estimate $18,150 · sent 5d, not viewed → nudge"; relocated from the old funnel), then overdue follow-ups. **Each row deep-links** to its surface (invoice → Billing, quote → Quotes, estimate → the project, call → contact). One chase list, not three overlapping cards — and nothing here is restated in a digest above.
5. **No standing number tiles** *(deliberate — the big cut)*. The old Pipeline funnel + KeyMetrics (Revenue / Outstanding) are **removed**. Each lives better elsewhere: financial scoreboard → **Business Health**, AR → **Billing**, pipeline/stage shape → the **Projects** list (one tap away in the nav, with filters + actions). Re-showing them here is the "smatter of whatever's available" we're avoiding — the dashboard *triages and launches*; the monitor screens monitor. The funnel's one *actionable* signal (a sent estimate going **stale in "awaiting approval"**) moves into the **chase list as a nudge row** (item 4), not a passive count.
6. **Recent Activity — limited + expandable** — show the latest ~5, then "View all" expands (or routes to the full feed). It's audit/reference, not action — demote it; never let it dominate the screen.

## Henry intelligence
- **No duplicating digest.** Henry shows up as **(a)** the **one-line read** in the header (orientation, never an item list), and **(b)** **embedded intelligence inside the cards** — the prioritization, the "Henry chased · no reply" flag on the chase row, the aging-estimate nudge, the celebration phrasing. Each item appears once; Henry's value is the *synthesis + flags*, not a separate card that parrots the others. (Truer to "Henry is the intelligence behind every feature, not a panel.")
- Keep the embedded bits: estimate-**celebration**, money-at-risk **reasoning** ("ignored the auto follow-ups"), the **verify** prompts. **No chat bubble emphasis** — the sidebar chat stays as-is.

## Money / Canadian
- **No standing money tiles.** Money appears on the dashboard **only inside the chase list** (overdue / at-risk invoices), each row **deep-linking to Billing**. Revenue + financial totals live on **Business Health**; AR detail on **Billing** — the dashboard doesn't restate them.
- The chase-list amounts read the **canonical AR helper**, never an independently-computed number (the RPC tax-bug; cards `fc43233b` / `3079b85e`).
- **CAD**, tabular-nums, de-emphasized cents on the chase-list amounts.

## Role variations
- **Owner / admin:** the full cockpit (money, margin, all projects). This brief.
- **Crew:** **N/A** — the worker dashboard is a separate surface; don't touch it here.
- **Homeowner:** **N/A** — they live in the portal.

## Mobile vs desktop
- **Desktop:** header (Henry one-line read) → celebration (if any) → action zone (Today / Blocked / Needs-You) → chase list → activity.
- **Mobile:** lead with the **Henry line + a win (if any) + Needs-You + Today**; chase list next; Recent Activity collapsed behind "View all". No metric strip to scroll past. 44px targets; PATTERNS.md §18.

## States
- **First run** (`FirstRunHero`) — keep for brand-new tenants (onboarding nudge).
- **Quiet day** (nothing needs you) — a calm positive state: the Henry line reads "Nothing needs you right now — you're caught up.", the action cards show empty ("Nothing due today" / "No blocked tasks"), no celebration. Don't fake urgency or pad with metrics.
- **Loading** — per-section skeletons (exist).

## Visual identity
Deepened **Paper** palette: white cards on paper, solid warm hairlines, ink text, mono eyebrows on section labels. Status via the token system (overdue = danger, awaiting = warning, active = success, complete = done). **Rust is the single accent** — reserve it for the Henry one-line-read accent + the one primary "needs you" CTA; chase-list danger uses red. The Henry line + celebration follow the **Henry-prompt rule** (sparkle + label; accent reflects state — rust = needs you, green = all-clear/win, never danger-red on a positive). Tabular-nums + de-emphasized cents. **Three type sizes max.**

## Open questions
- **Henry's one-line read tone** — the count is now defined (= the Needs-You decision count); the open part is how much flavor it carries. Plain count ("3 things need you today") vs. a Henry-flavored read ("clear two client calls and you're ahead"). And does it stack with the time-of-day greeting or replace it?
- **Multiple wins** — when several land at once (2 estimates accepted + an invoice paid), does Celebration stack, show the latest, or roll up to "3 wins this week →"? (Lean: a compact roll-up so it's never a wall of green.)
- **Sacred-path coupling** — with the funnel removed, the dashboard's only sacred-path touch is the *aging-estimate nudge* in the chase list; keep it consistent with the parallel sacred-path mapping when it lands.
- **Money-at-risk fold-in** — folding it into the one chase list is the de-dup recommendation; confirm we keep the "I called them" dismiss on those rows (vs. keeping Money-at-risk as its own card).
- **Personal to-do** (`PersonalTasksCard`) — keep as a compact demoted strip, or fold into the action zone? (Was empty in the live data.)
