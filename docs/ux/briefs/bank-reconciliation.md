# OD Brief — Bank reconciliation (the 50-clicks-to-one payment shortcut)

> **Grounded in (read these before prompting):**
> - **Routes (one workflow, two pages):**
>   - `src/app/(dashboard)/business-health/bank-import/page.tsx` → `BankImportFlow` (`src/components/features/bank-import/bank-import-flow.tsx`) — the upload→parse→match doorway. Carries the load-bearing **"What this is (and isn't)"** trust aside in the page header.
>   - `src/app/(dashboard)/business-health/bank-review/page.tsx` → `BankReviewQueue` (`src/components/features/bank-review/bank-review-queue.tsx`) — the suggested-match review queue. Server-loads `listBankReviewQueue(filters)` + `listImportedStatements()` from `src/lib/db/queries/bank-review-queue.ts`. Reads `?statement` + `?include_unmatched=1` off the URL.
> - **Data / actions:** `src/server/actions/bank-import.ts` (`parseBankStatementAction` preview / `importBankStatementAction` write+match), `src/server/actions/bank-match.ts` (`runAutoMatchAction` — the BR-5 engine, idempotent, only touches `unmatched`), `src/server/actions/bank-confirm.ts` (`confirmBankMatchesAction` → flips invoices/bills paid + stamps tx confirmed + one worklog summary; `rejectBankMatchesAction` → "not an invoice"). Matcher: `src/lib/bank-recon/matcher.ts` (`findMatchCandidates`, scoring rubric, `bucket()`); candidate pool: `src/lib/db/queries/bank-match-candidates.ts` (`getMatchPool`, ±30-day window). Parser: `src/lib/bank-recon` (preset detect + column map + dedup-normalize).
> - **Schema:** migrations `0170_bank_recon_tables` (`bank_statements` + `bank_transactions`; `match_status ∈ unmatched|suggested|confirmed|rejected|manual`, `match_confidence ∈ high|medium|low`, signed `amount_cents BIGINT`, `dedup_hash` unique per tenant → idempotent re-import, full RLS), `0189_bank_tx_match_candidates` (`match_candidates JSONB` top-3 denormalized + `match_score INT` for SQL ordering), `20260512045327_merge_bank_match_cost_id` (the two cost columns collapsed into one `matched_cost_id → project_costs`; `matched_invoice_id` stays). The candidate `kind` is still `invoice|expense|bill` in the JSONB even though expenses+bills now share `project_costs`.
> - **Parent + siblings:** **`docs/ux/briefs/business-health.md`** is the parent cockpit — its Subscreen Inventory already carries the inline contract for both these sub-flows ("Bank Import flow — HEAVY → graduate"; "Bank Review queue — HEAVY → graduate"). **This brief is that graduation. Extend the parent; do not contradict it.** Money siblings these feed: `invoices.md` (an invoice flips to `paid` here), `expenses.md` (a cost gets a bank-tx linkage here). Governing-principle source: the parent's *"operational truth, not the book of record"* section.
> - **Design system:** `PATTERNS.md` (§3 confirm dialogs, §5 `{ ok, error }` action result + toast, §6 empty states, §7 status badges → `src/lib/ui/status-tokens.ts`, §11 RLS, §23 tenant-tz dates), `DESIGN.md`, `globals.css` (Paper palette is **live**). Upload uses the shared `IntakeDropzone` (`src/components/features/contacts/intake-dropzone.tsx`).
> - **Vault (foundation):** Positioning `5bfa59be`, Object Model `b4d880be` (`bank_transactions` = the reconciliation accelerator, not a first-class object), Workflow Library `e0263cc3` (#7 Invoicing & Payment), Role × Object Matrix `03b1ccf4`, Design System Map `f9bf30bf`.
>
> **How to use:** paste into OD (HeyHenry "Paper" palette + DESIGN.md clarity discipline), generate hi-fi desktop of **both** surfaces (import flow + review queue) — desktop is the home for this; mobile is a "do this on desktop" redirect (see Mobile). Then run `heyhenry-design-critique`. Feeds Dev cards on the Ops `dev` board, tag `epic:ux-redesign`.
>
> **Governing principle (inherited from the parent — must survive the redesign):** this is a **payment shortcut, not bank reconciliation.** It matches bank lines to invoices/expenses/bills *already entered in HeyHenry* and lets the owner mark them paid in bulk. The **book of record stays in QuickBooks** — the bookkeeper reconciles against QBO's bank feed; transfers, fees, interest, ATM withdrawals are **"QBO's problem"** and are hidden by default. The "is / isn't" aside in the import header is **load-bearing trust copy** — keep it. **Import-only for V1** — there is no live bank-feed connection and shouldn't be one; QBO is the downstream system of record.

**Object / workflow / role(s):** primary = the **`bank_transaction`** (a parsed statement line + its ranked match candidates + match state), parented by a **`bank_statement`**; workflow = **Invoicing & Payment ▸ reconcile-the-paid-pile** (Workflow Library #7) — *one upload turns "is this paid?" into a pre-checked list the owner confirms in a click.* Roles: **owner** (home base) / **admin** (operational money). **Member / worker / client-portal: never** (see Role variations — inherits the parent's owner-draws gating open question). **Primary action:** *upload a month's statement → confirm the high-confidence matches in bulk → invoices/costs flip to paid, the rest is left for QBO.*

## Naming & copy discipline (carry through the whole design)
- **"client" not "homeowner"** — none present in code today (good); keep it that way in any new copy.
- **Confidence is a "band" or "level", never a "bucket"** — the code has a `bucket()` function and "bucket" in comments/queries; that's internals. **In UI copy: "high-confidence match", "confidence level", "by confidence band."** Never surface "bucket."
- **"Henry" never "HH."** The matcher *is* the Henry leverage here — label it (see Henry §). `✦` appears **only** on real Henry touchpoints (the match suggestion + the confidence read), nowhere decorative.
- **Rust is the one accent.** Status meaning comes from `status-tokens.ts` soft pairs, not raw hues. The primary CTA (`Confirm + mark paid`) is the one rust button on the queue.
- **Money:** CAD, `tabular-nums`, cents de-emphasized; signed (money-in vs money-out) carries a glyph/label, never colour-only.

## Purpose
The slice of Business Health where **50 manual "mark paid" clicks become one bulk-confirm.** A GC does a job, sends an invoice, gets paid by e-Transfer/cheque/Stripe; weeks later their statement lands. Instead of hunting each payment and clicking "mark paid" per invoice, they drop the statement once: Henry's matcher scores every line against unpaid invoices/costs, pre-checks the obvious wins, and one **Confirm** flips them all to paid. It is **not** a ledger, **not** a forecast, **not** bank reconciliation — it deliberately stops at "mark the paid pile paid" and hands everything else to QBO.

## Current vs target (the delta this brief drives)
Both surfaces are **built and working** (the BR epic shipped: BR-2 parser, BR-4 upload, BR-5 matcher, BR-7 queue). They function, but they read as **engineering output, not Paper**, and the Henry leverage is invisible. Six gaps:

1. **Raw status colours everywhere — must move to `status-tokens.ts`.** The preview confidence pill (`bank-import-flow.tsx` ~L290) and the queue `ConfidenceBadge` (`bank-review-queue.tsx` ~L415) hardcode `emerald-100/amber-100/rose-100/slate-100`; the amount column hardcodes `rose-700 / emerald-700` for out/in; the preview sample table tints columns `emerald/blue/amber`. Target: high→`success`, medium→`warning`, low→`hold`/`neutral` soft pairs, each with the tone **glyph** (`statusToneIcon`), never hue-alone. The DoneStage "auto_matched" count also hardcodes emerald. *(Same restyle #301 did for Overview / the parent's tone-token decision #4.)*
2. **The matcher isn't branded as Henry.** Confidence bands, "why it matched", suggested-only, pre-checking — this **is** the Henry intelligence, but nothing carries `✦` or a "Henry found these" frame. Target: a calm `✦ Henry` attribution on the match suggestion + a one-line "how Henry matched: amount + date + payee" disclosure. Labeled, never auto-acting (it never confirms money — a human clicks).
3. **`window.confirm()` on bulk-confirm — foot-gun + off-brand.** `confirmSelected()` (~L90) fires a native `window.confirm`. This is the **money-state-change gate** — it deserves the real shadcn `AlertDialog` (PATTERNS §3) with a proper summary ("N matches → X invoices paid · Y bills paid · Z expenses linked"). Reject is currently *un*-confirmed and instant — fine for single-row, but bulk reject should get the same dialog treatment.
4. **"why it matched" is cramped into one truncated line.** The match candidate renders as a single ellipsis-truncated muted span (date · kind · label · amount · date). The owner can't see *why* Henry is confident. Target: a structured match line (amount agreement, date proximity, payee text) so trust is legible — progressive-disclosed, not a wall.
5. **No loading / error / skeleton state.** `listBankReviewQueue` **throws** on query error → crashed route; the page has no `Suspense` skeleton. Target: skeleton rows on load, a graceful "couldn't load the queue, retry" card on error (mirrors the parent's metrics-RPC error target).
6. **"Re-run matching" doesn't exist in the UI.** `runAutoMatchAction({ statement_id })` is built and idempotent (only touches `unmatched`); the action comment literally calls a re-run button "a future button (post BR-7)." Target: surface it — the matcher misses invoices entered *after* import, so "Re-run matching" on the review queue (and in the import done-state's zero-match branch) closes the loop.

**Also flag — CSV-only today, not CSV/PDF.** The dropzone is hard-locked to `.csv,text/csv,text/plain`, the hint says "CSV only · max 5MB", and the parser + presets are CSV-only (RBC/TD/BMO/Scotia/CIBC/Amex/Generic). **PDF statement parsing is a target, not current** — design the upload zone so a future PDF path slots in (copy: "CSV today; PDF coming"), but don't draw a PDF flow as if it exists.

## The two-surface workflow (state machine the screens serve)
```
                ┌─────────────── IMPORT (bank-import) ───────────────┐
 upload CSV ─parse─▶ PREVIEW (detected preset · column map · sample) ─confirm─▶ written
   │                    │  override columns / re-parse / use another file        │
   │                    └──────────────────────────────────────────────┘        │
   │                                                                  auto-match runs (BR-5)
   ▼                                                                             ▼
 DONE state: "N added · M matched (K high-confidence) · rest left for QBO"  ──▶  ┐
                                                                                 │
                ┌─────────────── REVIEW (bank-review) ◀──────────────────────────┘
 queue: suggested-only, best-match-first, high-confidence PRE-CHECKED
   ├─ confirm selected ─[AlertDialog]─▶ invoices→paid · bills→paid · expenses→linked · tx→confirmed
   ├─ reject (not an invoice) ─▶ tx→rejected (stays for audit, never re-suggests)
   ├─ switch candidate (pick a different one of the top-3)
   ├─ filter by statement · toggle "show unmatched" (QBO's pile, off by default)
   └─ re-run matching (target) ─▶ re-scores still-unmatched rows after new invoices entered
```
- **Decision points:** which candidate (top-3 switcher); confirm vs reject vs leave; include-unmatched or not; re-run after entering missing invoices.
- **Failure modes the UI must handle:** parse failure / wrong column map (→ preview override + re-parse, already built); zero matches found (→ DONE-state "that's normal, enter the invoices then re-run"); duplicate re-upload (→ silent dedup, surface "K already imported (skipped)"); query error (→ retry card, target); accidental bulk-confirm (→ AlertDialog gate); a match the owner distrusts (→ "how Henry matched" disclosure + reject).
- **Money-state rule (locked):** money state changes **only on a human click** — the matcher pre-checks high-confidence but **never auto-confirms.** Confirm flips `invoices.status='paid'` (guarded `.eq('status','sent')` so it can't clobber another path) and `project_costs.payment_status='paid'` (vendor bills), links expenses, and — per QBO_PLAN §1.5 — the paid-invoice flip triggers the downstream QBO Payment push.

## Layout — IMPORT surface (`/business-health/bank-import`)
Desktop, top to bottom. Compose existing primitives; the multi-stage `Stage` machine (upload → preview → done) is sound — restyle, don't rebuild.

**1 · Header + the "is / isn't" trust aside (keep — load-bearing).** Page title "Import bank statement" + the one-line value prop ("Save yourself from clicking 'mark paid' 50 times a month…") + the bordered **What this is (and isn't)** aside (is: a payment shortcut; isn't: bank reconciliation; transfers/fees/interest belong in QBO). Keep all three bullets verbatim-in-spirit; restyle the aside to the calm `info`-soft pattern. A "← Business Health" ghost back-link top-right.

**2 · Stage 1 — Upload (`card`).** Statement label (`input`, e.g. "RBC Chequing — March 2026") · Bank `select` (Auto-detect + RBC/TD/BMO/Scotia/CIBC/Amex/Generic, "override only if detection fails") · the `IntakeDropzone` (single file, hint **"CSV only · max 5MB"** — *target copy: "CSV today; PDF coming"*) · **`Parse statement`** primary (rust), disabled until file + label present. Loading: spinner-in-button via `useTransition` (keep).

**3 · Stage 2 — Preview (`card`).** A detection summary row: a **confidence band pill** (high/medium/low — *retone to `status-tokens` soft pairs + glyph, drop the raw emerald/amber/rose*) · detected preset · date format · transaction count · an encoding-recovery note when used. **Override columns** (`Pencil` toggle) opens the column-mapper grid (date / description / signed-amount / debit / credit / date-format `select`s) → **Re-parse with overrides**. A collapsible **warnings** `details`. The **sample table** highlights the mapped date/description/amount columns (*retone the column tints to the Paper palette — the raw emerald/blue/amber reads loud*). Footer: "Save as" label `input` + **`Import N transactions`** primary. "Use a different file" ghost (top-right of card) resets to Stage 1.

**4 · Stage 3 — Done (`card`).** The import receipt: "**N** new transactions added · **M** matched to existing invoices/expenses/bills (K high-confidence) · rest unmatched (transfers/fees — belong in QBO) · K already imported (skipped) · W warnings." *(Retone the matched-count off raw emerald.)* Primary: **`Review N matches`** → bank-review (only when matches exist). Secondary: "Back to Business Health". The **zero-match branch** keeps its honest copy ("normal if you haven't entered the corresponding invoices yet") — *target: add a `Re-run matching` affordance here too.*

## Layout — REVIEW surface (`/business-health/bank-review`)
Desktop, top to bottom. The `card` + header + bulk-bar + divided row list is sound — restyle + layer trust.

**1 · Header (keep).** Title "Review bank matches" + the one-line ("Confirm the matches we found… high-confidence are pre-checked — confirm in bulk") + actions: "← Business Health" ghost · **`Import another statement`** (→ bank-import). *Target: add `Re-run matching` here (ghost/overflow) — re-scores still-`unmatched` rows after the owner enters invoices the matcher missed.*

**2 · Count summary + filter bar.** `CountSummary`: "**N** to review · K unmatched (those belong in QBO) · J done." *(Phrase counts by **band**: "N to review — H high · M medium · L low" so the owner knows what's pre-checked.)* `FilterBar`: statement `select` (All statements + each `source_label`) · **"Show unmatched"** checkbox (off by default — flipping it sets `?include_unmatched=1`). *(Both currently hard-navigate via `window.location.href`; fine, but a `≥44px` target.)*

**3 · Bulk bar (`status-tokens`-toned, sticky-ish).** Select-all checkbox (scoped to `suggested` rows) + "N selected" · the one **`Confirm + mark paid`** rust primary · **`Not an invoice`** ghost (bulk reject). Both disabled at zero selection. **Confirm fires the `AlertDialog`** (target — replaces `window.confirm`).

**4 · The review row (the heart — restyle + make "why" legible).** Grid per row: bulk `checkbox` (only on `suggested` rows; high-confidence **pre-checked**) · **date + statement label** (`tabular-nums`) · **bank description** (truncate w/ title) → under it the **match line**: `✦` + **confidence band badge** (`status-tokens` + glyph) + direction glyph (`→` out / `←` in) + kind (invoice/expense/bill) + candidate label + amount + candidate date · **other-candidates `select`** (top-3 switcher) when present · the **signed amount** (right, `tabular-nums`, in/out via glyph+tone not raw rose/emerald) · per-row **Reject** (`X`, `aria-label`). Unmatched rows (only visible with the toggle) show "Unmatched · transfer / fee / interest? Reject to skip." and no checkbox.

**5 · "How Henry matched" disclosure (target — trust).** On the row (popover or expand), show *why*: amount agreement (exact / ±$1 / within 1%), date proximity (±N days), payee text overlap — the matcher's own rubric, surfaced. This is what makes a pre-checked high-confidence match trustworthy enough to bulk-confirm. Labeled `✦ Henry`.

## Progressive disclosure
- **Snapshot:** (review) the count summary — "N to review, H high-confidence pre-checked" — the whole "how much can I clear in one click?" read above the fold. (import) the upload card.
- **Operational:** the row list itself — scan, uncheck any you distrust, **Confirm**. The preview sample table on import.
- **Detail:** "how Henry matched" disclosure per row; the top-3 candidate switcher; column-override mapper on import. A single invoice/cost is **not edited here** — it deep-links out to `invoices.md` / `expenses.md` (target: make the candidate label a deep-link).
- **Audit:** `bank_transactions` keep `matched_by` + `matched_at`; confirm writes **one** worklog summary (not 50 rows); rejected rows persist (never re-suggest); statements carry `uploaded_at` + `matched_count`. No separate audit view in V1.

## Henry intelligence touchpoints *(the matcher IS the leverage — surface it; it never auto-acts on money)*
- **`✦` The match engine (BR-5)** — on import, Henry scores each bank line against the ±30-day pool of unpaid invoices (inflow) / expenses + bills (outflow) on a deterministic rubric (amount 50 / date 30 / text 20; ≥85 high, 60–84 medium, 30–59 low, <30 dropped → stays unmatched), and writes the **top-3 ranked candidates**. **Deterministic, not a model** — say so; it's why it's trustworthy. Henry **proposes**; high-confidence is **pre-checked** for one-click bulk-confirm but **never auto-confirmed** — money flips only on a human click. Label the band; show *why* it matched (§Review-5).
- **`✦` Suggested-only triage** — Henry's strategic call that **unmatched = QBO's problem** is itself the intelligence: it hides transfers/fees/interest by default so the owner only sees the actionable pile. Frame the hidden count as a *decision* ("K left for QBO"), not an omission.
- **Undo / reversibility:** confirm is the committing action (gated by AlertDialog); reject is reversible by re-running the matcher (sets back to suggested only if still unmatched — note: rejected rows stay rejected by design). No silent state change anywhere. Per `[[henry-intelligence-not-chat]]` — this is embedded intelligence in the feature, **not** a chat box.
- **Not Henry (don't `✦` it):** preset auto-detection and column mapping are deterministic parser plumbing, not Henry — a confidence *pill* is fine but no `✦`.

## Role variations
- **Owner:** the full surface — this is part of their money home base. Upload, review, bulk-confirm.
- **Admin:** operational money view is reasonable (reconciling the paid pile is operational, not owner-personal like draws). Same surface as owner.
- **Member:** **inherits the parent's open gating question** — the route isn't role-gated in code today (any dashboard member can reach the URL), but marking invoices paid is a sensitive money action. Recommend: gate to **owner + admin** (tighter than the parent's "hide draws from member," since this *writes* paid state). Needs an Ops decision (touches route guard / RLS — a Coding follow-up).
- **Worker:** never — `/w` has no financial surface.
- **Client / portal:** never — internal cash/cost reconciliation; not a portal surface. No client-facing view exists or should. (Homeowner boundary: never expose match candidates, costs, or supplier names.)

## Mobile vs desktop
*"Mobile = doing work; desktop = thinking work."* This is thinking/admin work — a desktop affordance.
- **Desktop:** the full import flow (file upload + column-mapping) and the review queue (multi-select + bulk-confirm). This is the home for both surfaces.
- **Mobile:** **do not force statement import/review onto a phone.** File-pick + a wide multi-column review grid are hostile on mobile. Show a calm "Do this on desktop" redirect (mirrors the parent's mobile decision for the bank tools). If a minimal mobile review is ever wanted, it's a stacked one-card-per-tx confirm — defer; not V1. All interactive controls **≥44px**.
- **Offline:** upload requires a connection — disable + explain, don't silently drop (parent's offline rule).

## Financial / Canadian
- **CAD, cents, tabular money**, cents de-emphasized. Amounts are **signed** — money-in (invoice payment) vs money-out (expense/bill payment) shown by **glyph + tone**, never raw rose/emerald.
- **Source-agnostic by design** — the matcher reconciles **e-Transfer at parity with cheque / Stripe / cash**; it matches on amount+date+payee, not payment rail. A statement line is a statement line. **No holdback.**
- **GST/HST:** invoices match on their **tax-inclusive** total (`invoice_total_cents`, mirrored into the match pool) — a $1,130 bank deposit matches a $1,000 + $130 HST invoice. The owner reconciles the *gross* deposit; the tax split lives on the invoice, not here.
- **Canadian bank presets** are a real Canadian-SMB primitive: RBC / TD / BMO / Scotia / CIBC / Amex auto-detect out of the box — most contractors bank with one of these; "override only if detection fails."
- **The QBO handoff is itself a Canadian-contractor trust primitive** — they have a bookkeeper working in QBO; this tool feeds clean paid-state over and never pretends to be the book of record.

## States
- **Empty (review, nothing to review):** the existing calm line — per-statement: "Nothing to review for this statement. All matches confirmed or skipped."; global: "Nothing waiting. Import a bank statement to see suggested matches here." Pair the global one with the empty-state pattern (icon + headline + the **`Import bank statement`** CTA).
- **Empty (import, fresh):** the upload card *is* the empty state — keep, it's self-explanatory with the trust aside.
- **Zero matches found (import done):** keep the honest branch — "No matches yet — normal if you haven't entered the corresponding invoices/expenses. Re-run matching after entering them." *(Target: wire an actual `Re-run matching` button here.)*
- **Loading:** *(target — currently missing)* skeleton rows for the review queue (`skeleton` primitive, match the row grid); spinner-in-button already covers parse/import/confirm transitions.
- **Error:** *(target — currently throws → crashed route)* `listBankReviewQueue` should degrade to a "Couldn't load your matches — retry" card, not a 500. Action writes already use `{ ok, error }` + `toast` (keep).
- **Offline:** disable upload + explain (no silent drop).

## Subscreen inventory *(every surface this workflow spawns)*
- **Import flow `/business-health/bank-import`** — **this brief (the import half).** The 3-stage `Stage` machine (upload → preview → done) is a self-contained client flow on one route; specced inline above. Not further graduated.
- **Review queue `/business-health/bank-review`** — **this brief (the review half).** The hero surface; specced above.
- **Confirm-and-mark-paid dialog** — **LIGHT → inline (target).** Trigger: `Confirm + mark paid` with ≥1 selected. Content: a real `AlertDialog` (PATTERNS §3) summarizing "N matches → X invoices paid · Y bills paid · Z expenses linked; invoices/bills flip to paid, expenses link for audit." Actions: Confirm (rust) / Cancel. States: working (spinner), success-toast with the per-kind breakdown, error-toast. **Replaces the current `window.confirm`.**
- **Bulk-reject confirm** — **LIGHT → inline (target).** Same `AlertDialog` treatment for `Not an invoice` on a multi-selection ("Mark N transactions as not-an-invoice? They stay for audit but won't re-suggest."). Single-row reject (the per-row `X`) stays immediate (low-stakes, reversible-ish via re-run).
- **Column-override mapper** — **LIGHT → inline (already built).** Trigger: "Override columns" on preview. Content: 6 `select`s (date/description/signed-amount/debit/credit/date-format). Actions: Re-parse with overrides. States: re-parsing spinner, parse-error toast.
- **Top-3 candidate switcher** — **LIGHT → inline (already built).** Trigger: per-row "other candidates" `select` when >1 candidate. Content: top-3 by score with amount + band. Action: pick → sets which candidate confirm will use. (`candidate_index`, server clamps 0–2.)
- **"How Henry matched" disclosure** — **LIGHT → inline (target).** Trigger: per-row info/expand. Content: the rubric breakdown (amount/date/payee). Read-only; no actions.
- **Statement filter + show-unmatched toggle** — **LIGHT → inline (already built).** URL-param driven (`?statement`, `?include_unmatched=1`).
- **Re-run matching** — **LIGHT → inline (target).** Trigger: button on review header + import zero-match branch. Calls `runAutoMatchAction` (idempotent; only `unmatched` rows). States: working, "re-scored N rows — M new matches" toast.
- **Deep-links out (not subscreens):** a confirmed/candidate invoice → `invoices.md` (`/invoices/[id]`); a cost → `expenses.md`. *(Target: make the candidate label a deep-link.)*

## Accessibility
WCAG 2.2 AA: **confidence bands never colour-only** — band badge carries label + `statusToneIcon` glyph (current `ConfidenceBadge` is hue + text but on raw tokens — move to `status-tokens` + glyph); **signed amount** (in/out) carries a direction glyph (`→`/`←`) + tone, never rose/emerald alone (current gap). All money `tabular-nums`. The bulk checkboxes have `aria-label`s (keep) and the row reject has `aria-label="Reject"` (keep); the select-all is a real labeled checkbox. The review list is real list/row semantics with labeled inputs. `AlertDialog` traps focus + is keyboard-operable. **≥44px** tap targets on checkboxes, the statement `select`, the show-unmatched toggle, and bulk buttons (the inline confidence-switcher `select` is currently `h-6` — bump for touch). Focus rings on rows, checkboxes, and the Confirm primary.

## Decisions / Open questions
1. **Member gating (inherited + sharpened).** The route isn't role-gated today; this surface **writes paid-state**, so recommend **owner + admin only** — tighter than the parent's draws-panel rule. Needs an Ops decision + a Coding route-guard/RLS follow-up (a kanban card, not a render change).
2. **CSV → PDF.** PDF statement parsing is a **target, not current** (CSV-only end to end). Design the upload zone to accommodate a future PDF path; don't draw a PDF flow. Confirm whether PDF is in scope for this redesign cycle or a later epic.
3. **Re-run matching surfacing.** The action exists and is safe; confirm placement (review header overflow + import zero-match branch) and copy. Closes the "invoice entered after import" gap.
4. **Tone tokens + `✦`.** Adopt `status-tokens.ts` soft pairs (high→success / medium→warning / low→hold) + glyphs, and brand the matcher with `✦ Henry`; retire raw `emerald/amber/rose/slate/blue`. (Parent decision #4 precedent.)
5. **`window.confirm` → `AlertDialog`.** Confirm the bulk-confirm + bulk-reject gates move to the PATTERNS §3 dialog. (The money-state change deserves the real dialog.)
6. **Candidate `kind` vs unified costs.** The JSONB still emits `invoice|expense|bill` though expenses+bills now share `project_costs` (`matched_cost_id`). Display copy can keep the three labels (they're meaningful to the owner: "invoice" / "expense" / "bill"), but note the underlying merge so the deep-link targets the right `project_costs` row regardless of `kind`.
7. **Loading/error states.** Confirm the skeleton + retry-card targets (currently absent; the query throws). A Coding follow-up alongside the restyle.
8. **Mobile redirect vs minimal mobile review.** V1 = "do this on desktop." Confirm there's no appetite for a stacked mobile confirm-list now (defer).
