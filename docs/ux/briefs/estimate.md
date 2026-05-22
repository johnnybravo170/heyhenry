# OD Brief — Estimate (scope → preview → approval)

> **Grounded in:** `src/components/features/projects/tabs/budget-tab-server.tsx`, `budget-categories-table.tsx` (the authoring table — sections → categories → cost lines, inline edit, dnd reorder, progress bars), `cost-line-form.tsx`, `cost-line-actuals-inline.tsx`, `scope-scaffold-generator.tsx`, `starter-template-picker.tsx`, `last-used-price-hints.tsx`, `estimate-approval-actions.tsx`, `estimate-sent-banner.tsx`, `estimate-feedback-card.tsx`, `estimate-terms-editor.tsx`, `estimate-customer-view-picker.tsx`, `estimate-preflight-warnings.tsx`, `estimate-preview-send-bar.tsx`, `estimate-render.tsx`, `project-document-type-toggle.tsx`, `src/app/(dashboard)/projects/[id]/page.tsx` + `estimate/preview/page.tsx`, `src/app/(public)/estimate/[code]/{page,approval-form,view-logger}.tsx`; actions `estimate-approval.ts` (`sendEstimateForApprovalAction:55`, `approveEstimateAction:290`, `declineEstimateAction:374`, `resetEstimateAction:251`, `submitEstimateFeedbackAction:667`), `manual-approval.ts` (`manuallyApproveEstimateAction:115`), `project-cost-control.ts` (`upsertCostLineAction`), `project-budget-categories.ts`; `lib/estimate/preflight.ts`, `lib/providers/tax/canadian.ts`; migrations `0046` (cost lines), `0050` (estimate approval), `0097` (lifecycle_stage); `lib/ui/status-tokens.ts`; `components/ui/money.tsx`; PATTERNS.md §2/§3/§4/§5/§6/§7/§9/§22/§24/§26; DESIGN.md (Paper palette + clarity discipline). Vault: Object Model `b4d880be`, Role Matrix `03b1ccf4`, Project Hub spec `6c0de27d`, Workflow Library `e0263cc3`; and `docs/ux/sacred-path-map.md`.
> **How to use:** paste into the OD project (HeyHenry "Paper" palette — deepened + the typographic-clarity discipline in DESIGN.md), generate hi-fi desktop + mobile, then run `heyhenry-design-critique`.
>
> **Read this first — what "the estimate" actually is.** For the GC/renovation vertical (V1's only audience), the estimate is **NOT** the `quotes` table or the pressure-washing `quote-form` (that surface hard-redirects renovation/tile tenants away — `quotes/page.tsx:32`). The GC estimate **is the project itself**: `project_cost_lines` + `project_budget_categories`, gated by `projects.estimate_status` (`draft → pending_approval → approved | declined`). It's authored on the project's **Budget tab**, sent from **`/projects/[id]/estimate/preview`**, and approved by the customer on the public **`/estimate/[code]`**. This brief covers that arc. The legacy PW quote builder is out of GC V1 scope — do not design it.
>
> **Current vs target:** the flow is already **capable and shipping** — a unified self-gating Budget view, inline editing everywhere, drag-reorder, $0-line/envelope-drift preflight, a recipient checklist, GST first-send gate, manual (verbal/text/in-person) approval with proof upload, read-receipt on first view, scope scaffolding + starter templates, and last-used price hints. So this is a **refinement** brief, not a rebuild. Target deltas: (1) make the **authoring posture legible** and quiet the dormant execution columns; (2) re-skin to **Paper + the three-type-size discipline** (the table currently runs ~6 font sizes and raw red/amber/blue); (3) a **running estimate total + margin read** while authoring; (4) **Henry-prompt chrome** on scaffold / hints / preflight; (5) tuned **mobile**. **Flagged** where target differs from current.

**Object:** the **Project's estimate** (`project_cost_lines` grouped by `project_budget_categories`, gated by `projects.estimate_status`) · **Roles:** owner / admin / member (author + send + approve); homeowner (view + approve, public) · **Primary action:** build the scope → **Preview & send** → get it approved.

## Purpose
The operator's **make-the-contract** surface. A reno GC builds a priced scope (categories and line items, with cost/markup), sees their number and their margin, sends a clean branded estimate, and gets a yes — by link or recorded verbally. The approved estimate becomes the **contract baseline** every later change order diffs against. This is the heaviest, highest-stakes screen in the app: get it wrong and nothing downstream is trustworthy.

## The data truth this screen must reflect
- **The estimate lives on the project, not a quote.** `project_budget_categories` (grouped into free-text **sections** — e.g. "Kitchen", "Bathroom") each carry an `estimate_cents` envelope; `project_cost_lines` are the itemized lines (`label`, `qty`, `unit`, `unit_cost_cents`, `markup_pct`, `unit_price_cents`, `line_price_cents`, `category` ∈ material/labour/sub/equipment/overhead, `notes`, photos).
- **Single source of truth:** when a category has priced lines, **Σ `line_price_cents` IS the estimate** — the envelope is a fallback for line-less categories (`budget-categories-table.tsx:1098`). The inline envelope edit is correctly disabled once lines exist; the operator moves the number by editing lines. Keep this.
- **`estimate_status`** (`draft → pending_approval → approved | declined`) is a sub-state of **`lifecycle_stage`** (`planning → awaiting_approval → active → …`). Send flips draft→pending_approval + planning→awaiting_approval; approval flips →approved + →**active**. The project **already exists** before the estimate (created at lead-accept / New project) — so there is **no "create project on approval"** step for GC (that orphan only exists on the legacy PW quote path). *This supersedes the "auto-create project" open question from the sacred-path map for the GC path.*
- **On approval, two things fire automatically** (`estimate-approval.ts:346,351`): Henry seeds tasks from the scope categories, and the scope is **snapshotted as the "Original estimate" baseline** for diff-tracked change orders. The approved estimate is the contract.
- **Cost-plus vs fixed-price:** `projects.is_cost_plus` (default true) + `management_fee_rate` (default 0.12) — the management fee is a line on the customer estimate; cost-plus governs the final-invoice math downstream.
- **The customer sees price, never cost.** The preview/public render reads `unit_price_cents` / `line_price_cents` only — never `unit_cost_cents` or `markup_pct`. This boundary is load-bearing (Role Matrix portal rule) — the brief must keep cost/markup operator-only.
- **Document type** is `estimate | quote` (`document_type` toggle) — labels the customer-facing doc; default "estimate".

## The two postures — the heart of this screen *(target: make them legible)*
The Budget tab is **one table that serves two jobs**, switched by state (`budget-tab-server.tsx:28` — "One view — no Editing/Executing toggle"). This is the real story behind the old "Editing/Executing modes": not a toggle, a **state-adaptive surface**.
- **Authoring posture** (`estimate_status` draft/declined, pre-approval): the job is **build + price scope**. The columns that matter are **Category · Estimate (price) · Margin**. The execution columns — **Spent · Committed · Remaining + progress bars** — are dormant ($0) and are pure **noise** here.
  - **Target:** in authoring posture, **collapse/hide the Spent/Committed/Remaining columns and progress bars**; lead with scope + price + a **margin read** (cost vs price). Surface the **Send for approval** path prominently. *(Flag — real behavior change to `budget-categories-table.tsx`.)*
- **Execution posture** (`approved`, lifecycle active+): the same table tracks **actuals** — Spent/Committed/Remaining wake up, progress bars fill, CO chips appear, "spent by source" populates. **This posture is specified in the forthcoming Project Hub brief.**
- **Hard constraint for OD:** these are **two faces of ONE component**, not two screens. Design the authoring face here; the Hub brief designs the execution face; they must reconcile into a single table that adapts by `estimate_status`/`lifecycle_stage`. Don't fork it.

## Layout — authoring posture (the scope builder)
- **Header / context:** project name + customer + a clear **estimate-state chip** (Draft · Sent {Nd ago} · Approved · Declined) reading from `status-tokens.ts`. The `EstimateSentBanner` (with **read-receipt** view stats) and `EstimateApprovalActions` row (Mark approved/declined, Copy link, Reset, Preview) stay — restyled to Paper.
- **The scope table** (`budget-categories-table.tsx`): **Sections → Categories → cost lines**, all inline-editable (§4 keyboard contract: Enter saves, Esc cancels, blur saves — already correct). Keep: drag-reorder (dnd-kit), section up/down + rename, click-the-number to edit, detail-aware delete + 5s undo, "+ Add line" / "+ Add category" / "+ New section", catalog picker + last-used hints in the line form, batch-add (form stays mounted, refocuses label). Keep CO chips (link to the CO).
  - **Authoring columns (target):** **Category · Qty/unit · Cost · Markup% · Price** — money right-aligned, tabular-nums, de-emph cents (the `Money` component already does the `.00` shim; extend its discipline). Cost + Markup are the operator's margin levers and belong **in the row**, not buried only in the expanded `CostLineForm`. *(Flag — surfaces cost/markup at the row level in authoring.)*
- **Empty scope → Henry's blank-page solve:** `ScopeScaffoldGenerator` (describe the job → Henry drafts sections/categories) + `StarterTemplatePicker` (start from a saved template). These are the first thing on an empty estimate. Henry-chrome them (below). `SaveAsTemplateButton` lives in the table header once scope exists.
- **Terms + doc type:** `EstimateTermsEditor` (with snippets from Settings) + `ProjectDocumentTypeToggle` (estimate/quote) sit below the table — restyle, keep.

## The estimate total — running, always visible *(target — new)*
Today the grand total (subtotal + management fee + GST + total) only appears on the **preview** page; while authoring, the operator sees per-section subtotals but not **the number**. Add a **sticky estimate-summary** in authoring posture: **Subtotal → Management fee ({rate}%) → GST/HST → Total**, CAD, tabular-nums, de-emph cents — plus an operator-only **Margin** read (Σ price − Σ cost, and margin %). The customer's number and the GC's margin, both live as they build. (Reuse the preview's math: `subtotal = Σ line_price_cents`, `mgmtFee = subtotal × management_fee_rate`, tax via `canadianTax.getCustomerFacingContext`.)

## Preview & send (`/projects/[id]/estimate/preview`)
A focused, max-w-2xl "what the customer will see" page. Keep all of it, restyle to Paper:
- **`EstimateRender`** — the branded customer document (logo, business, customer, scope by section, descriptions, photos, mgmt fee, **province-aware GST/HST label**, GST/WCB numbers, terms, validity window). **Price-only — no cost/markup.**
- **`EstimateCustomerViewPicker`** — `detailed` vs `summary` (`customer_summary_md`): how much line detail the homeowner sees. Keep; make the privacy implication obvious.
- **`EstimatePreflightWarnings`** — $0 line items, envelope-vs-lines drift. Non-blocking. **Henry-chrome as a pre-send check** (warn-soft, not danger — they can still send).
- **`EstimatePreviewSendBar`** (sticky): **Send to {first name}** → confirm dialog with a **recipient checklist** (primary + saved additional emails pre-checked, opt-out per-send, "+ Also CC" one-off), a **personal note**, and the **`AutoFollowupRow`** (the quote-follow-up autopilot — Henry chases a silent estimate; gated to Growth plan). No-email-on-file → inline capture → save to customer → send. **GST first-send gate:** `requiresGstNumber` → `GstNumberPromptDialog` → retry (keep — Canadian compliance). Enter-to-send shortcut. On success → back to Budget tab.

## The customer approval hand-off (`/estimate/[code]`, public, no login)
- Keyed by `estimate_approval_code` (good — code-keyed, unlike the legacy id-keyed quote/invoice public pages; the sacred-path map flags unifying those). `noindex`.
- **`EstimateRender`** (same doc) + **`EstimateApprovalForm`** — shows only when `pending_approval`. **E-signature = typed full name** → `approveEstimateAction`.
- **No customer "decline" button by design** — the customer can leave **feedback/comments** (`submitEstimateFeedbackAction` → `project_estimate_comments`, surfaced to the operator via `EstimateFeedbackCard`), but "declined" is **operator-reserved**. Keep this — it keeps the GC in the conversation instead of getting a hard no. Make "Have a question / request a change" feel as natural as "Approve".
- **`ViewLogger`** fires on first real view → emails the operator (read-receipt). Keep.
- **Manual approval** (`manuallyApproveEstimateAction`): the operator records a **verbal / text / in-person** approval with method + proof file + notes — this is how a lot of reno deals actually close. First-class, not a footnote; surface it in `EstimateApprovalActions`.
- **Public visual identity:** the public render is intentionally token-free plain styling today. Target: it should still look **professional + branded** (logo, clean type, the Paper warmth) — it's the customer's impression of the GC. It does **not** need the dashboard chrome.

## Henry intelligence (guide, not hero — embedded, not a chat)
Apply the **consistent Henry chrome**: ✦ **HENRY** label + thin **rust left-border** + **rust reserved for the action button**; **fill reflects meaning** — a *positive/ready* nudge uses **rust-soft peach `#FEF0E3`**; a cautionary check uses **warn-soft**; a generic heads-up stays **white/neutral**; **never danger-red on a positive**.
- **Scope scaffold** (`ScopeScaffoldGenerator`) — "Describe the job, I'll draft the scope." The blank-page killer. Henry-chrome, peach (it's a generative assist).
- **Starter templates** (`StarterTemplatePicker` / `SaveAsTemplateButton`) — reuse a prior estimate's shape. Each estimate sent compounds the library.
- **Last-used price hints** (`last-used-price-hints.tsx`) — "you billed $X for this last time." Inline by the price field; quiet, Henry-labeled.
- **Preflight** (`runEstimatePreflight`) — $0 lines, envelope drift — a warn-soft pre-send check.
- **Margin guard** *(target):* when authoring drops margin below a threshold, a quiet warn nudge ("this category's at 4% — intended?"). Operator-only; never shown to the customer.
- **Stale-estimate chaser** — the `AutoFollowupRow` autopilot (SMS@24h / email@48h, CASL-aware) is the "Stale Quote Chaser" for GC estimates; it reads `/quotes/stale` (which queries projects `estimate_status='pending_approval'`).

## Role variations
- **Owner / admin / member:** full authoring + send + approve + see **cost/markup/margin**. (RLS is tenant-scoped, role-agnostic across these three for project data — per Role Matrix.)
- **Worker:** **N/A** — workers don't see estimates, pricing, or financials (assigned field work only).
- **Homeowner:** public `/estimate/[code]` — view + approve (or comment) on **their** estimate only; **price-only**, never cost/markup/margin, never another customer's anything.

## Mobile vs desktop
Estimate authoring is **"thinking work" → desktop-primary** (Project Hub spec). The dense scope table (`min-w-[760px]`, horizontally clipped below 760px today) is a desktop builder.
- **Desktop:** the full inline-editable table + sticky estimate summary.
- **Mobile:** the operator should **review, send, and check status** — not build line-by-line. Degrade the table to **stacked section/category cards** (name · price · margin chip), the **estimate summary** as a compact total, and a thumb-reachable **Preview & send**. The send confirm (recipient checklist + note + follow-up) → a **bottom sheet**, not a cramped dialog. 44px+ targets. Approval-status banner + read-receipt visible. Line-item add/edit is available but secondary (most GCs author at the desk, tweak from the truck).

## Financial / Canadian
- **CAD** throughout, tabular-nums, **de-emphasized cents** (extend the `Money` component's discipline across the table — it already pads the `.00` shim).
- **GST/HST** is **province-aware** via `canadianTax.getCustomerFacingContext` (label + rate); **tax-exempt** customers zero it with a "Tax exempt" label. **GST number required on first send** (gate). Show **GST + WCB numbers** on the customer doc.
- **Management fee** as the cost-plus markup line; **no holdback** (dropped from the model).

## States
- **Empty scope:** Henry scaffold + starter templates (above) — not a dead empty state; the blank-page solve *is* the empty state.
- **Draft (scope exists):** authoring posture; "Preview & send" available.
- **Sent / awaiting approval:** `EstimateSentBanner` + read-receipt stats; **resend keeps the same link**; follow-up autopilot status visible.
- **Approved:** signed banner (who/when, or manual method + proof), scope locked as baseline; the surface tips toward execution posture (Hub brief); CTA shifts to "Create invoice" / start the job.
- **Declined:** declined banner + reason; `resetEstimateAction` to revise back to draft.
- **Feedback received:** `EstimateFeedbackCard` (customer comments, line-targeted "Re: Demolition") — operator addresses, then resends.
- **Loading:** skeleton.

## Visual identity
Deepened **Paper** palette: warm paper field, white cards/table that float, **solid warm hairlines** (no zebra), near-black ink. **Collapse to three type sizes (16/14/12)** + the 4-step ink ramp for hierarchy — the current table runs ~6 sizes (9/10/11/12/13/14px), which the clarity discipline forbids. **Color is reserved for action:** **rust is the single accent** (the primary Send/CTA + Henry action buttons); move the raw `red-600` / `amber-600` / `blue-100` over/projected/CO colors onto **`status-tokens.ts` soft pairs** (over = danger-soft, projected-over = warn-soft, CO chip = info-soft). Progress bars in token colors, not `gray-200`/`green-500`. Mono-uppercase eyebrows for column heads + "SECTION" labels. Money right-aligned, tabular, de-emph cents. The **estimate state chip** via `status-tokens.ts`.

## Accessibility
WCAG 2.2 AA: near-black ink on white (~16:1); never color-only for over-budget/CO/status (pair with label/icon — `status-tokens.ts` icons already do this); inline edits keep the §4 keyboard contract + visible focus ring; drag-reorder has the existing keyboard sensor — keep; the typed-name e-signature input is labeled + required; ≥44px targets on mobile send/approve.

## Open questions
- **Authoring vs execution column hiding** — confirm hiding Spent/Committed/Remaining in pre-approval is desired (vs. just de-emphasizing). It's the cleanest posture cue but it's a real change to a shared component — needs blessing (and must reconcile with the Hub brief).
- **Row-level cost/markup** — surfacing Cost + Markup% as table columns in authoring (vs. only in the expanded line form): worth the width on desktop? (Lean yes — margin is the GC's whole game.)
- **Margin guard threshold** — fixed % or per-tenant setting? Defer the setting; start with a sensible default + dismissible nudge.
- **`document_type` estimate vs quote** — does GC ever want "quote" wording, or is "estimate" always right for reno? (Minor.)
- **Shared-component boundary with the Hub brief** — this brief owns the authoring face; the Hub brief owns execution. Sequence the Hub brief next so the single adaptive table is designed coherently.
