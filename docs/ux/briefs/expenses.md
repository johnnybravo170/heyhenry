# OD Brief — Overhead Expenses & GST (the owner's tax & cost back-office)

> **Grounded in:** `src/app/(dashboard)/expenses/page.tsx` ("Overhead expenses") + `expenses-table.tsx` + `expenses/new` / `expenses/[id]/edit` (`OverheadExpenseForm`), `expenses/gst/page.tsx` + `gst-remittance-panel.tsx`, `expenses/import/page.tsx` (`ReceiptImportWizard`); queries `listOverheadExpenses` (`overhead-expenses.ts:46`, filters `source_type='receipt'` + `project_id IS NULL`), `getGstRemittanceReport` (`gst-remittance.ts:109`); actions `logExpenseAction`/`logExpenseWithReceiptAction` (`expenses.ts:179/251`), bulk recategorize/set-source; `extract-receipt.ts` (Gemini OCR), `vendor-intelligence.ts` (vendor→category), `recurring-rules-card.tsx`, `/api/expenses/gst-remittance-csv`; `project_costs` schema (`0046`). Adjacent (not this screen): project-linked costs on the **Spend tab** (`project-hub.md`); vendor **bills** (`upsertBillWithAttachmentAction`/`markBillPaidAction`) are wired **project-side**; bank reconciliation at `/business-health/bank-import`; the **cross-project** unified view + period-lock live in the **bookkeeper portal** (`/bk/expenses`, `/bk/exports`). `status-tokens.ts` + `Money` (`components/ui/money.tsx`) — **not used here (gap)**. Vault: Object Model `b4d880be`, Canadian-compliance memory, `docs/ux/sacred-path-map.md`. Siblings: **`briefs/invoices.md`** (which defers GST reporting *to here*), **`briefs/project-hub.md`** (Spend tab).
> **How to use:** paste into the OD project (HeyHenry "Paper" palette — deepened + the clarity discipline in DESIGN.md), generate hi-fi desktop + mobile, then run `heyhenry-design-critique`.
>
> **Scope correction (from grounding).** This is **not** a cross-project job-costing dashboard. The in-scope **owner** surface is two things: **Overhead Expenses** (`/expenses` — operating costs *not* tied to a project, `project_id IS NULL`) and the **GST Remittance** report (`/expenses/gst`), plus the **Receipt Import** wizard (`/expenses/import`). Project-linked job costs live **per-project on the Spend tab**; the **cross-project** unified cost view + books-close belong to the **bookkeeper portal** (`/bk/*`), which is **deferred / out of V1 scope** (locked decision). Don't design `/expenses` into a cross-project costing view — that's the bookkeeper's.
>
> **Current vs target:** built and functional — an overhead expense ledger, a strong **receipt-OCR import** (Gemini, 50-file batch) with **vendor→category** auto-fill, and a real **GST remittance** report (GST collected on paid invoices − ITCs on costs = net owed; period presets; CSV export; mark-as-filed; **missing-BN flags** for CRA ITC risk). Gaps: the screen uses **raw `formatCurrency`, no `Money`/`status-tokens`**, **no filters / search / pagination** (it renders *every* row), plain styling, ad-hoc amber for "uncategorized"; and the **unpaid-bill pile is invisible here** (bills are project-side). Target: Paper + `Money` + tokens + three type sizes; filters/search/pagination; the **receipt drop-zone as the primary "log a cost" path**; a calm, confident GST position with Henry-chromed BN cautions. **Flagged** where target differs.

**Object:** the **overhead expense** (`project_costs`, `source_type='receipt'`, `project_id` null) + the **GST remittance position** · **Roles:** owner / admin (money + tax) · **Primary action:** log an overhead cost (drop a receipt) · know what GST you owe.

## Purpose
The owner's **tax-and-overhead back office.** Two jobs: (1) **capture overhead** (the truck insurance, the phone bill, the shop rent, the Home Depot run that isn't a job cost) fast and clean; (2) **know the GST position** — what you collected, what you can claim back, what you owe CRA this quarter — without a spreadsheet. It's the least customer-facing screen on the path, but GST is a Canadian non-negotiable and clean overhead is what makes the project margin numbers honest.

## The data truth this screen must reflect
- **Overhead = `project_costs` with `project_id IS NULL`** (`source_type='receipt'`, `payment_status='paid'`). Project-linked receipts/bills are *excluded* here (they're on the Spend tab). So `/expenses` is deliberately the **non-project** slice.
- **GST remittance** (`getGstRemittanceReport`): **collected** = GST on **paid** invoices in range (`paid_at`); **ITCs** = GST paid on active `project_costs` in range (`cost_date`, regardless of paid status), split into overhead-by-category + project-work-by-project; **net owed = collected − ITCs**. Period presets (month/quarter/year, **default this-quarter**) + custom range.
- **CRA hygiene:** ITCs ≥ $30 with GST claimed but **no vendor BN** (`vendor_gst_number`) are flagged (CRA can deny the claim). The report is explicitly **"a bookkeeping aid, not a CRA filing tool"** — keep that honest framing.
- **Vendor bills** (`source_type='vendor_bill'`, `payment_status` unpaid/partial/paid) exist but are authored + paid **on the project Spend tab**, not here — so the "what do I owe vendors" view is currently **per-project only**.
- **QBO is import-only** (parked) — these numbers are HeyHenry-native; nothing pushes to QuickBooks.

## Layout — Overhead Expenses (`/expenses`)
- **Header:** "Overhead expenses" + a **summary strip** (total amount · GST · entry count for the active view). CTAs today: GST/HST · Categories · Payment sources · **Import receipts** · **Log expense**. **Target:** keep Log + Import as the two primary actions (Import-receipts is the Henry path — see below); move Categories + Payment-sources to a settings/overflow (they're config, not daily actions); GST/HST becomes a clear link to the report.
- **The table** (`expenses-table.tsx`): Date · Category · Vendor · Paid-by (payment-source pill) · Description · Tax · Amount · receipt-thumb · delete; bulk select → **Recategorize / Set source / Delete**. Keep the bulk power; restyle.
  - **Target — add the missing controls:** **filters** (date range, category, vendor, payment source, **uncategorized-only**) + **search** + **pagination/virtualization**. Today it renders **every** row unbounded — a real perf + scannability gap as the ledger grows. (The bookkeeper twin already has an uncategorized toggle — bring that filtering here.)
  - **Money discipline:** route every amount through **`Money`** (tabular, de-emph cents) instead of raw `formatCurrency`; right-align. "Uncategorized" → a **`warning`-soft** token chip (not ad-hoc amber) — it's a "needs you" cue.
- **Receipt-driven entry is the spine** (see Henry).

## GST Remittance (`/expenses/gst`)
A confident, calm "here's where you stand with CRA this period":
- **The position:** Collected − ITCs = **Net owed** (or refund), big and clear, CAD/tabular. The ITC breakdown (overhead-by-category + project-by-project) as expandable detail, not a wall.
- **Period:** the preset chips (this/last quarter default, month, year) + custom range — keep; make the active period unmistakable.
- **CRA hygiene as a Henry caution:** the **missing-BN** list (ITCs at risk) surfaced as a Henry-chromed **warn-soft** card — *"3 claims ($420 GST) are missing a vendor BN — CRA may deny these. Fix before you file."* with a jump to each. (Workflow-first: it's a checklist the owner acts on, Henry just flags.)
- **Filing:** **CSV export** (keep; PDF later), **Mark as filed** (persists `gst_remittances`; filed periods show a Filed card + Unmark). Keep the honest **"bookkeeping aid, not a CRA filing tool"** disclaimer.

## Henry intelligence — *workflow first; OCR is the accelerator on top*
The manual **Log expense** form must be excellent on its own (vendor, category, amount, GST, payment source, receipt, project-or-overhead). Henry then accelerates it — it never replaces it:
- **Receipt drop → OCR → pre-filled expense** (`/expenses/import`, `extract-receipt.ts` / Gemini, **50-file batch**). The drop-zone is the *fast* path: snap/drop receipts, Henry extracts vendor/date/amount/GST, you confirm. **Make it the prominent primary capture path** (the manual form stays one tap away). Henry-chrome it; review-before-commit; never silent.
- **Vendor → category auto-fill** (`vendor-intelligence.ts`): "Home Depot → Materials" pre-fill on the form + in the OCR prompt. Quiet, learns from history.
- **Missing-receipt / missing-BN flags:** the BN flag (above) is built; a "this cost has no receipt" nudge fits the same Henry-caution pattern.
- **Henry-prompt chrome** where it appears: ✦ HENRY + rust left-border + rust action; **fill = meaning** (warn-soft for CRA/missing-data cautions; never danger-red on a non-error). Henry drafts/extracts; the owner confirms.

## Role variations
- **Owner / admin:** full — log/import overhead, categorize, see GST + net-owed, mark filed.
- **Member:** **likely none** (overhead + GST is owner/admin financial) — **confirm** (open question). Field workers log *project* expenses on `/w`, not overhead here.
- **Bookkeeper:** the real home for cross-project costing + period-lock + filing is the **deferred `/bk` portal** — design owner/admin now; leave the seam.
- **Homeowner:** **N/A** — never sees costs.

## Mobile vs desktop
- **Mobile = capture:** the **receipt drop/snap** is the killer mobile action (you're at the supplier counter) — camera → Henry OCR → confirm. Quick "log expense." 44px+ targets.
- **Desktop = reconcile + file:** the full ledger (filters, bulk recategorize) + the GST report + export. Dense table → stacked cards on mobile (Date · Vendor · Amount · category chip · receipt-thumb).

## Financial / Canadian
- **CAD**, tabular-nums, de-emph cents (via `Money`). **GST/HST** is the whole point — province-aware where relevant; **ITC** logic (pre-tax vs gross); **vendor BN** capture + the CRA missing-BN flag; net-owed by period. **No holdback.** This screen is where Canadian-first earns its keep — make it feel like it was built for a BC reno GC at quarter-end, not a generic SMB.

## States
- **Empty (no overhead yet):** "Drop a receipt or log your first overhead expense." + the two paths.
- **Filtered/searched empty:** "No expenses match." + clear.
- **Uncategorized present:** a quiet count + an uncategorized-only quick-filter (the one thing that needs attention).
- **GST — clean period:** confident net-owed; **with BN gaps:** the warn-soft Henry card on top.
- **Filed:** the Filed card + Unmark.
- **Loading:** skeleton.

## Visual identity
Deepened **Paper**: white card table on warm paper, solid hairlines, ink text, mono-uppercase column heads + metric eyebrows. **`Money` everywhere** (tabular, de-emph cents, right-aligned). Status/uncategorized via **`status-tokens.ts`** soft pairs (no ad-hoc amber). **Rust is the single accent** — the primary Log/Import action + Henry action buttons; the GST net-owed figure is data, not an alarm (neutral unless a real CRA risk → warn-soft). **Three type sizes.** Date formatting via the `formatDate` helper (tenant tz), not inline `Intl`.

## Subscreen inventory
The standalone **overhead / G&A expenses** surface (distinct from a project's Spend tab). Subscreens spec inline; nothing graduates.

**Modals / dialogs**
- **Overhead-expense form** (`overhead-expense-form`) — amount · category · date · vendor · **receipt upload** (§1) · **GST tax-split chip** (§22 — auto-splits net/tax on Total blur, override).
- **Duplicate-expense dialog** (`duplicate-expense-dialog`, §15) — flags a likely duplicate on save → keep / discard.

**Inline / transient**
- **Receipt thumbnail preview** (§21) in rows; **filters** (All / category / period); pagination; the GST net-owed + period summary.

**No graduate** — overhead expenses are a single list + form surface.

## Accessibility
WCAG 2.2 AA: near-black ink on white; never colour-only for uncategorized/BN-risk (label + glyph); filters/search keyboard-operable; receipt-thumb has alt; the GST net-owed + period are announced; ≥44px targets on mobile capture; bulk-select is keyboard-reachable with clear focus.

## Open questions
- **Member access** — does a non-owner/admin see overhead + GST, or is this owner/admin-only? (Lean owner/admin — confirm in Role Matrix.)
- **The unpaid-bill / AP gap** — vendor bills live per-project; there's no owner-side "what do I owe vendors across all jobs" view in scope (that's the bookkeeper portal). Is a lightweight cross-project AP glance wanted for V1, or strictly per-project until `/bk` ships? (Lean per-project for V1.)
- **Filters scope** — match the Contacts/Billing filter-bar pattern (chips + search + sheet on mobile)? (Yes — reuse it.)
- **GST PDF** — CSV exists; is a printable PDF remittance summary wanted for the accountant handoff, or is CSV enough until `/bk`?
- **Pagination vs virtualization** — given an unbounded ledger, server-pagination (like Contacts/Billing) or client virtualization?
