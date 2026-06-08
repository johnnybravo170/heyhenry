# OD Brief — Business Health (the owner's money cockpit)

> **Grounded in:** `src/app/(dashboard)/business-health/page.tsx` (the surface: 5 metric cards + owner-draws panel + the two bank sub-routes + the QBO-handoff aside), `src/components/features/business-health/business-health-cards.tsx` (the 5 KPI cards + tone logic), `src/components/features/business-health/owner-draws-panel.tsx` (optimistic quick-add + inline-edit ledger), `src/lib/db/queries/business-health-metrics.ts` (`getBusinessHealthMetrics` → the `get_business_health_metrics(p_year)` RPC, SECURITY INVOKER / RLS-scoped), `src/server/actions/owner-draws.ts` (`createOwnerDrawAction` / `updateOwnerDrawAction` / `deleteOwnerDrawAction` / `listOwnerDrawsAction`). Sub-routes: `src/app/(dashboard)/business-health/bank-import/page.tsx` (`BankImportFlow`), `src/app/(dashboard)/business-health/bank-review/page.tsx` (`BankReviewQueue`, query `src/lib/db/queries/bank-review-queue.ts` → `listBankReviewQueue` + `listImportedStatements`, matcher `src/lib/bank-recon/matcher`). Data: the RPC aggregates **`invoices`** (AR; revenue = paid, tax-aware via `invoice_total_cents`), **`project_costs`** (AP / expenses), **`owner_draws`** (`draw_type` ∈ salary | dividend | reimbursement | other; `amount_cents`; `paid_at`), **`bank_transactions`** (`match_status` ∈ unmatched | suggested | confirmed | rejected | manual; `match_score`; `match_confidence` ∈ high | medium | low; `match_candidates` JSONB) + **`bank_statements`** (`source_label`, `row_count`, `matched_count`). Migrations `0169_business_health_metrics_rpc`, `20260522170008_ar_tax_aware_business_health`. Vault: Object Model `b4d880be`, Role × Object Matrix `03b1ccf4` (**Business Health is the owner's home base** — "what needs attention, cash, jobs at risk, approvals pending"), Workflow Library `e0263cc3` (#6 Job Costing, #7 Invoicing & Payment), Positioning `5bfa59be`. Siblings: **`invoices.md`** (the per-invoice Billing/AR surface this rolls up), **`expenses.md`** (the per-cost AP surface), `dashboard.md` (the operational what-needs-doing home).
> **How to use:** paste into the OD project (HeyHenry "Paper" palette), generate hi-fi desktop + mobile of the **main cockpit** (cards + owner-draws + the attention strip), then run `heyhenry-design-critique`. The two bank sub-routes are specced in the Subscreen Inventory and graduate to their own renders.
>
> **Governing principle — operational truth, not the book of record.** Business Health is the **owner's fast money read**, not bookkeeping. The book of record stays in QuickBooks (or wherever the bookkeeper works); HeyHenry pushes clean transactions over and never tries to replace bank reconciliation in QBO. The product line is already in the page copy and **must survive the redesign**: bank-import "**is** a payment shortcut; **isn't** bank reconciliation." Everything here optimizes for *"where do I stand today, and what needs my attention,"* not ledger completeness. (This is also why the heavy bookkeeper objects — GST remittances, year-end — live in the out-of-scope `/bk` portal, not here.)
>
> **Current vs target:** `/business-health` is built and live — five flat KPI cards (Revenue YTD · AR outstanding · AP outstanding · Owner pay YTD · Net cash flow YTD) off one RPC, an optimistic owner-draws ledger, and two working sub-routes (bank-import, bank-review). **Target (the delta):** (1) a **cockpit treatment** — lead with the one thing that needs attention (overdue AR, negative cash) instead of five equal-weight cards; (2) **Paper-palette status tokens + rust `✦`** for tone and Henry, replacing the raw `emerald-600`/`rose-600` the cards use today (the same restyle #301 did for Overview — see `src/lib/ui/status-tokens.ts`); (3) **Henry attention strip** (AR-aging chase, cash-at-risk) surfaced, never auto-acting; (4) the native `confirm()` on draw-delete → the PATTERNS.md confirm-dialog. **Flagged** where target differs from today.

**Object:** there is no single "business health" row — the surface is a **read-aggregate over money objects** (`invoices` → AR, `project_costs` → AP, `owner_draws` → owner pay, `bank_transactions` → the reconciliation accelerator). The one *editable* object here is the **Owner Draw**. · **Roles:** owner (home base — full); admin (operational money view); member (?? — see Role variations / open question); worker + client/portal (never). · **Primary action:** read where the business stands this fiscal year in one glance, then act on the thing that's off — chase overdue AR, or bulk-clear paid invoices via a bank statement.

## Purpose
The account-level answer to *"is the business OK this year?"* — the owner's money home base alongside the operational `/dashboard`. Dashboard answers "what do I need to **do** today" (jobs, inbox, approvals); Business Health answers "what's the **money** doing this year" — revenue in, money out, owner pay, and what's owed to/by me. It's a thinking-and-deciding surface, not a doing surface, and it deliberately stops at the operational layer: the bookkeeper's QBO is still the book of record.

## Layout *(regions — compose from `card`, `badge`, `button`, `money`, `table`, `input`, `select`, `dialog`)*
1. **Header** — "Business Health" + the one-line "where your business stands this year" + fiscal-year context (the RPC returns `fy_start`/`fy_end` — show the FY, not just the calendar year, since tenants can have non-calendar fiscal years). Header actions: **Review matches** (→ bank-review) and **Import bank statement** (→ bank-import).
2. **Attention strip *(target — new)*** — a single Henry-toned line above the cards: *"$X across N invoices overdue >30d"* and/or *"Net cash negative this month."* Calm rust `✦`, links into the offending list. If nothing's wrong, a quiet "Nothing needs your attention" — don't manufacture alarm.
3. **The five KPI cards** *(current — restyle, don't rebuild)* — `Revenue YTD` (paid invoices, FY-to-date → `/invoices?status=paid`) · `AR outstanding` (total + count + **oldest age**; negative tone at ≥30d → `/invoices?status=sent`) · `AP outstanding` (count of unpaid bills) · `Owner pay YTD` (total + by-type breakdown) · `Net cash flow YTD` (revenue − expenses − owner pay; positive/negative tone). Cards that link are click-through; tone via status-tokens.
4. **Owner draws ledger** *(current)* — `Owner draws · {year}`: quick-add (amount · type · date · note) + inline-editable rows, optimistic with toast-rollback. The one place owner salary/dividend/reimbursement is recorded operationally.
5. **The QBO-handoff aside** *(current — keep, it's load-bearing for trust)* — "How this fits with your bookkeeping": operational view, books live in QBO, we push transactions over, we don't replace bank rec. Restyle to the calm info pattern; don't drop it.

## Progressive disclosure
- **Snapshot:** the attention strip + the five numbers — the whole "am I OK?" read above the fold.
- **Operational:** click a card → the underlying list (paid invoices, sent/overdue invoices, unpaid bills). Owner draws expand inline to edit. "Import bank statement" / "Review matches" are the bulk-action doorways.
- **Detail:** a single invoice or cost is *not* on this surface — it deep-links out to `invoices.md` / `expenses.md`. Business Health rolls up; it never becomes the line-item editor (that's the edge discipline below).
- **Audit:** owner draws carry `created_by` + timestamps; bank statements carry `uploaded_at` / `matched_count`. No separate audit view in V1.

## Henry intelligence touchpoints *(surfaces + accelerates; never auto-acts on money)*
- **Bank-statement matching** *(already the core AI leverage)* — on import, the matcher scores each bank line against unpaid invoices/expenses/bills and assigns `match_confidence` high/medium/low with `match_candidates`. Henry **proposes**; the human confirms the mark-paid. High-confidence is pre-checked for bulk-confirm, but **never auto-confirmed silently** — money state changes only on a human click. Label the confidence; show *why* it matched (amount + date + payee).
- **AR-aging chase** — "3 invoices overdue >30d ($X) — send a reminder?" One tap to the invoice's existing send/remind flow. Labeled `✦ HENRY`, dismissible. Henry drafts the nudge; the owner sends (outbound-to-customer is always human-in-the-loop).
- **Cash-at-risk read** — "Net cash negative this month: $X in bills due before $Y in AR is likely to land." Deterministic from dates + amounts, not a forecast model. Display/undo rules per `[[henry-intelligence-not-chat]]`.

## The edges — what touches money but must NOT be rebuilt here
| Surface | Role | Business Health's relationship |
|---|---|---|
| **`/invoices`** (Billing/AR — `invoices.md`) | Per-invoice authoring, send, mark-paid, Stripe/e-Transfer | Business Health **rolls up** AR + revenue and **deep-links** in; never edits an invoice inline |
| **`/expenses`** (AP — `expenses.md`) | Per-cost capture/categorize/pay | Rolls up AP; deep-links; no cost editing here |
| **`/dashboard`** | Operational "what to do today" | Sibling home base — Dashboard = action, Business Health = money. Don't duplicate the jobs/inbox feed here |
| **`/bk` bookkeeper portal** | GST remittances, year-end, owner draws (book-of-record) | **Out of redesign scope.** Business Health is the *operational* mirror; the bookkeeper's QBO/`/bk` is authoritative. Owner draws are entered here for the owner's read, pushed to the books — not double-kept |

## Role variations
- **Owner:** the full cockpit — this is their home base. Cash, AR, AP, owner pay, bank tools.
- **Admin:** operational money view (AR/AP/cash) is reasonable; **owner draws (salary/dividend) are owner-personal** — see open question on gating the draws panel below.
- **Member:** open question — the route isn't role-gated in code today (any dashboard member can reach the URL), but cash + owner-pay is sensitive. Target: at minimum hide the owner-draws panel from members; possibly gate the whole surface to owner+admin.
- **Worker:** never — `/w` has no financial surface.
- **Client / portal:** never — internal cost/cash/owner-pay; not a portal surface. (No "homeowner" view exists or should.)

## Mobile vs desktop
*"Mobile = doing work; desktop = thinking work."* Business Health is thinking work.
- **Desktop:** the full cockpit; bank-import + bank-review (file upload + bulk review) are desktop affordances.
- **Mobile:** glance the five numbers + the attention strip (overdue AR, cash); add a quick owner draw on the go. **Don't** force bank-statement import/review onto a phone — link to "do this on desktop." ≥44px tap targets on cards/rows.

## Financial / Canadian
- **CAD, cents, tabular `Money`**, de-emphasized cents. Revenue + AR are **tax-aware** (the RPC mirrors `invoice_total_cents` incl. GST/HST — `20260522170008`).
- **Owner draws** map to Canadian owner-comp reality (salary vs dividend vs reimbursement) — keep the type taxonomy; it feeds the bookkeeper's year-end (T-slips in `/bk`, out of scope here).
- **Payments** reconcile from any source — e-Transfer at parity with Stripe/cheque/cash (the bank-import matcher is source-agnostic). **No holdback.**
- The QBO-handoff line is itself a Canadian-SMB-contractor trust primitive — they have a bookkeeper; don't pretend to replace them.

## States
- **Empty (new tenant, no money yet):** cards render $0 / "Nothing awaiting payment" / "No unpaid bills" / "No draws recorded" — already handled; keep it calm and add a one-line "as you send invoices and log expenses, this fills in."
- **Loading:** card grid is `Suspense`-skeletoned today (keep the rhythm); owner-draws + bank queue get their own skeletons.
- **Error:** the metrics RPC currently **throws** — target a graceful "couldn't load your numbers, retry" card instead of a crashed route. Owner-draw writes already use `{ ok, error }` + toast + optimistic rollback.
- **Offline:** desktop planning surface, not offline-first; bank-import upload requires connection (disable + explain, don't silently drop).

## Subscreen inventory *(don't skip — this surface spawns two heavy sub-flows)*
- **Bank Import flow** `/business-health/bank-import` — **HEAVY → graduate to its own render/row.** Multi-step: upload statement (CSV/PDF) → parse → matcher runs → land in the review queue. Trigger: header CTA. Content: drop zone (reuse the upload-zone pattern) + the "is/isn't" trust aside. States: parsing, parse-failure, zero-matches-found. Spec the full flow in its own brief if the OD/Coding lane needs the step-by-step; inline contract = "upload → match → hand to review."
- **Bank Review queue** `/business-health/bank-review` — **HEAVY → graduate.** Queue of `bank_transactions` ordered best-match-first, **suggested-only by default** (unmatched = "QBO's problem" unless `?include_unmatched=1`). Confidence-banded counts (high/medium/low — *band/level, never "bucket" in copy*); high-confidence pre-checked; **bulk confirm** marks the matched invoices/costs paid. Per-row: the bank line (date · amount · description) + its candidate match(es) + confirm/reject/match-manually. Filter by statement. Spec inline contract here; full interaction in its own render.
- **Owner Draws panel** — **LIGHT → inline (already specced above).** Quick-add form + inline-edit rows; delete confirm → upgrade native `confirm()` to the confirm-dialog pattern.
- **Card → list deep-links** — not subscreens; they navigate to `invoices.md` / `expenses.md` surfaces.

## Accessibility
WCAG 2.2 AA: card tone never colour-only (positive/negative carry a glyph or label, not just emerald/rose — this is a current gap to fix in the restyle); KPI values are `tabular-nums`; confidence bands in the review queue use label + glyph, not hue alone; the owner-draws table is real table/list semantics with labeled inputs (already has `aria-label`s); ≥44px targets; focus rings on cards, rows, and bulk-confirm.

## Decisions / Open questions
1. **Card hierarchy** — *target:* break the five equal cards into a cockpit (the at-risk number leads; the rest are secondary). Confirm with OD whether one hero number + four supporting reads, or a 2-tier grid.
2. **Owner-draws gating** — *open:* the route isn't role-gated today. Recommend: hide the owner-draws panel from `member`; decide owner-only vs owner+admin for the cash/AR/AP read. Needs an Ops decision (touches RLS/route guard — a Coding follow-up, not a render change).
3. **Fiscal year vs calendar year** — the RPC already returns `fy_start`/`fy_end`; surface the **fiscal** framing in the header (current copy says "this year" generically).
4. **Tone tokens** — adopt `status-tokens.ts` + rust `✦` (the #301 Overview restyle precedent); retire raw `emerald-600`/`rose-600`.
5. **Attention strip scope** — V1 = AR-aging + net-cash sign. Defer richer forecasting; this surface stays a *read*, not a planning model.
