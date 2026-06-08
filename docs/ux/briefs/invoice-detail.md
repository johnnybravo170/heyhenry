# OD Brief — Invoice detail / draft (`/invoices/[id]`) — the operator invoice workspace

> **Grounded in (read before prompting):**
> - **Route:** `src/app/(dashboard)/invoices/[id]/page.tsx` (the operator's per-invoice page — **built**, pre-Paper-fidelity).
> - **Components:** `invoice-view-mode-preview.tsx` (the live customer-view preview, PATTERNS §25 — drafts only), `invoice-line-items.tsx` (add/remove line edits, draft), `invoice-note.tsx` (customer note, draft), `invoice-overrides-editor.tsx` (per-invoice payment-instructions/terms/policies override), `invoice-actions.tsx` (send / pay link / mark-paid / void), `invoice-status-badge.tsx`, `cost-basis-drift-banner.tsx`, `missing-gst-notice.tsx`, `invoice-defaults-setup-banner.tsx`, `record-payment-dialog.tsx` (§19), `shared/print-button.tsx`. Data: `getInvoice`, `loadInvoiceCustomerViewInputs`, `getProjectCostBasisRollup`, `canadianTax`. Actions: `applyCustomerViewToInvoiceAction`, `duplicateInvoiceAction`, the send/mark-paid/void actions.
> - **Vault (current-state):** `Module: Customer view modes` `0b2ee5bc` (the live-preview is **shipped** — three persistence postures; PATTERNS §25 is canonical) · design plan `b4c4b553`. Foundation: Positioning `5bfa59be`, Object Model `b4d880be`, Role Matrix `03b1ccf4`, Workflow Library `e0263cc3` (#7 Invoicing & Payment). Design system: `DESIGN.md`, `status-tokens.ts`, PATTERNS §19 (record-payment) / §21 (receipt thumbs) / §25 (live-preview-with-toggles) / §23 (tz).
> - **Siblings:** `invoices.md` (the Billing/AR **list** this drills into — it flagged this page to graduate), `project-hub.md` §Billing (the project Billing tab that also opens this), `customer-documents.md` (the **customer's** counterpart — the public `/view/invoice/[id]` pay surface this screen sends).
>
> **How to use:** paste into OD (Paper palette + DESIGN.md), generate hi-fi desktop + mobile, then `heyhenry-design-critique`. Graduated out of `invoices.md`'s subscreen inventory (heavy enough for its own screen). Dev cards → Ops `dev`, `epic:ux-redesign`.
>
> **⚠ Current vs target — built, but pre-redesign.** The page works end-to-end (customer-view preview, line edits, note, overrides, send, mark-paid, status sections, drift/GST banners, worklog, duplicate). The deltas are **styling + hierarchy + keying**, not function: (1) raw `amber-50 / emerald-50 / destructive` Tailwind + `rounded-xl bg-card` → **Paper + `status-tokens`**; (2) the header echoes the **raw UUID** (`Invoice #{id.slice(0,8)}`) → a friendly/code-keyed number (security + consistency, per `customer-documents.md`); (3) up to **five stacked sections/banners** on a draft (preview · drift · missing-GST · defaults-setup · overrides) → a calmer hierarchy; (4) align with the OD-fidelity passes the Mini shipped on the Billing list (#288) + project Billing tab (#296). Flagged inline.

**Object / workflow / role(s):** the **Invoice** (`doc_type` draw / invoice / final; `status` draft → sent → paid | void) in its detail/edit posture; workflow = **Invoicing & Payment** (Workflow Library #7) — *finish the draft, send it, get paid, record the payment*. Roles: **owner / admin** (member view); **homeowner never** (they get the public pay surface). **Primary action:** depends on status — **draft → finish & send**; **sent → record the payment (or chase)**; **paid → done (receipt on file)**.

## Purpose
The operator's **one-invoice workspace**: dial in what the customer will see (line detail, mgmt-fee presentation), confirm the money + GST, send it, and record payment. It's the bridge between the project's billing (the draw/final that created it) and the **customer's pay experience** (`/view/invoice/[id]`, `customer-documents.md`). The draft is where the operator controls the customer-facing output before it goes out; once sent, it's a payment-tracking surface.

## Current vs target (the delta this brief drives)
1. **Paper restyle (the bulk of it).** Replace raw `amber-50/200` (sent), `emerald-50/200` (paid), `destructive/5` (void) and `rounded-xl border bg-card` with **`status-tokens` soft pairs** + Paper card tokens; 3 type sizes (16/14/12); Money tabular + de-emph cents (already via `formatCurrency` — keep). The `Invoice #` heading is `text-2xl` — bring into the type ramp.
2. **Stop echoing the raw id.** `Invoice #{shortId(id)}` exposes a UUID prefix. Target: a **friendly invoice number** (or the `approval_code` once keying is unified — `customer-documents.md` Security pass). The visible doc number should be a real number, not `#a3f9c1b2`.
3. **Calm the stacked sections.** A draft can stack: customer-view preview → (drift banner) → (missing-GST) → (defaults-setup) → overrides editor → actions. Target a clear hierarchy: **the preview is the hero**; drift/GST are **inline cautions** (`status-tokens` warn/danger-soft, not full banners); defaults-setup + overrides collapse into a single **"Document details"** disclosure (they're config, not the main task).
4. **Status-posture clarity.** The page should read its posture instantly: **draft = a workbench** (editable, preview-forward); **sent = awaiting-payment + chase**; **paid = a calm receipt**; **void = neutral, closed.**

## The data truth this screen must reflect
- **Status drives everything:** `draft` → editable (line items, note, overrides, view-mode preview, send); `sent` → awaiting payment (record-payment / resend / chase); `paid` → receipt (date · method · reference · notes · receipt thumbnails); `void` → closed. Duplicate offered on paid/void.
- **Customer-view preview is built & gated** (PATTERNS §25, vault `0b2ee5bc`): shows only when **`isDraft && !tax_inclusive && project_id`**. Toggles = **view mode** (lump-sum / sections / categories / detailed) + **mgmt-fee inline** (lump-sum only). **Apply** materializes `invoices.line_items` + persists the toggle columns; recomputes `tax_cents`. When it shows, it **replaces** the Amount-breakdown card (it *is* the breakdown). Tax-inclusive drafts skip it (different `line_items` semantics — would mis-total).
- **Tax:** province-aware GST/HST via `canadianTax` (label honestly: "GST (5%)" vs "GST (5%, included)"); tax-inclusive vs tax-exclusive changes the subtotal math. CAD.
- **Cost-basis drift** (cost-plus drafts): frozen Labour + Materials lines vs the live project rollup; >$1 delta → a caution to regenerate (catches stale drafts + missing-source bugs).
- **GST# / WCB#** render in a registration footer; a draft/sent invoice missing GST# surfaces the `MissingGstNotice` (defense-in-depth; the send gate should prevent it).
- **Payment is recorded server-side**: Stripe checkout pre-created at send (URL in `invoices.pdf_url`); **manual** mark-paid records cash / cheque / **Interac e-Transfer** (`record-payment-dialog`). **No partial payments; no holdback.**

## Layout (regions → real primitives) — *restyle the as-built*
Desktop, centered (max ~`3xl`/720px), top to bottom:
1. **Detail nav** (`DetailPageNav` → "All invoices") — keep.
2. **Header** — **friendly invoice #** (not the UUID) + `InvoiceStatusBadge` (via `status-tokens`) + "Created {date}" (tenant tz); Duplicate on paid/void. Calm identity, 16px title.
3. **The money surface (status-dependent):**
   - **Draft + previewable →** the **customer-view preview** (`InvoiceViewModePreview`) as the hero: the toggle row (view mode · mgmt-fee inline) + portal-style preview cards + **Apply**. Frame it "**what the customer will see**." This is the breakdown.
   - **Otherwise →** the **Amount breakdown** card: Subtotal → line items → GST (honest label) → **Total** (tabular) + registration footer.
4. **Customer note** (`InvoiceNote`, draft-editable).
5. **Customer + Job links** (two cards → contact / project). Restyle to Paper.
6. **Status section** — **sent:** awaiting-payment (warn-soft) + chase; **paid:** receipt (emerald→success-soft: date · method · ref · notes · **receipt thumbnails** §21); **void:** neutral closed.
7. **Cautions (inline, not stacked banners):** cost-basis drift (danger-soft, "regenerate"); missing-GST (warn-soft, inline fix). 
8. **"Document details" disclosure** (collapse `InvoiceDefaultsSetupBanner` + `InvoiceOverridesEditor`) — per-invoice payment instructions / terms / policies; config, not the main task.
9. **Actions** (`InvoiceActions`) — status-aware primary: **draft → Send** (rust); **sent → Record payment** (`record-payment-dialog`) + Resend; always **Print**. 
10. **History** — invoice-related worklog timeline (keep).

## Progressive disclosure
- **Snapshot:** status + total + the one status-appropriate action.
- **Operational:** the customer-view preview (draft) / the breakdown; the note; record-payment.
- **Detail:** "Document details" disclosure (instructions/terms/policies); line-item editing.
- **Audit:** the worklog History + the paid receipt block.

## Henry intelligence touchpoints
Henry here is **operator-facing decision support**, not chat:
- **Customer-view preview** *(built)* — the live "what the customer sees" feedback loop is the intelligence: the operator picks detail level, sees the rebuilt invoice instantly. Keep; make the "this is the customer's view" framing explicit.
- **Cost-basis drift** *(built)* — a risk-spot ("billed Labour/Materials no longer match the project's live cost — regenerate?"). Restyle as a Henry-toned caution.
- **AR follow-up** *(upstream)* — the chase nudges live on the Billing/AR list (`invoices.md`), not here. No chat box; no ✦ sparkle on the money itself.

## Connections
- **In:** opened from the **Billing/AR list** (`invoices.md`) and the **project Billing tab** (`project-hub.md` §Billing → "New draw"/"Generate final" create the draft, land here).
- **Out:** **Send** → the customer **public pay surface** `/view/invoice/[id]` (`customer-documents.md` — Interac at parity there); **Record payment** (`record-payment-dialog`, §19, shared with the list); customer/job links → contact / project hub.
- **Reads** project data for the preview (cost lines, categories, sections, mgmt rate, prior-billed, cost-plus breakdown via `loadInvoiceCustomerViewInputs`).

## Role variations
- **Owner / admin:** full — edit draft, set view mode, send, record payment, void, duplicate.
- **Member:** view (no send/void/payment) — confirm against the action gates.
- **Homeowner:** **never** this page — they get `/view/invoice/[id]` (the branded pay surface). No cost/markup/margin here ever leaks to them (this is operator-side; the preview shows *customer prices*, never margin).

## Mobile vs desktop
- **Desktop:** the full workbench — preview toggles + line editing + the details disclosure side-by-side legibility.
- **Mobile:** operators DO send + record-payment from the truck. The **status-appropriate primary action is a thumb-reachable ≥44px button** (Send / Record payment); the preview stacks single-column; "Document details" stays collapsed; receipt thumbnails tappable. Print is desktop-leaning.

## Financial / Canadian
**CAD**, tabular, de-emph cents (`formatCurrency`). **Province-aware GST/HST** (`canadianTax`) with an honest inclusive/on-top label; **GST# + WCB#** footer. **Interac e-Transfer at parity** in record-payment (method picker) + on the customer pay surface it sends to. Cost-plus vs fixed governs the draft's line shape. **No holdback; no partial payments.**

## Subscreen inventory
**Modals / dialogs**
- **Record-payment** (`record-payment-dialog`, §19) — mark paid: amount · **method (cash / cheque / Interac / card)** · reference · notes · receipt upload.
- **Defaults-setup** (`invoice-defaults-setup-banner` → dialog) — set tenant payment-instructions / terms / policies inline (no Settings detour).
- **Send** (`invoice-actions`) — recipient (customer email + additional) → sends the pay link; preview-before-send.
- **Void / Duplicate** confirms (§3 AlertDialog; duplicate → new draft route).

**Inline editors / disclosures**
- **Customer-view preview toggles + Apply** (`invoice-view-mode-preview`, §25) — view mode · mgmt-fee inline → materializes line_items.
- **Line items** (`invoice-line-items`, draft) — add / remove / edit lines.
- **Customer note** (`invoice-note`, draft).
- **Overrides editor** (`invoice-overrides-editor`) — per-invoice instructions / terms / policies (fold into "Document details").

**Inline / transient**
- Cost-basis **drift** caution · **missing-GST** notice · sent/paid/void status sections · receipt thumbnails (§21) · worklog History.

**Sub-route (the customer counterpart)**
- `/view/invoice/[id]` — the public pay surface this screen sends → `customer-documents.md` (not this operator screen).

## States
- **Draft:** workbench — preview/breakdown editable, note + overrides, **Send** primary; cautions inline if drift/missing-GST.
- **Sent:** awaiting-payment (warn-soft) + sent-on date; **Record payment** + Resend.
- **Paid:** success-soft receipt — date · method · ref · notes · receipt thumbnails; Duplicate.
- **Void:** neutral closed; Duplicate.
- **Loading:** light skeleton. **Error:** `{ ok, error }` → toast.

## Accessibility
WCAG 2.2 AA: status never colour-only (badge label + the §status-tokens glyph); the preview toggle group is a labeled radio/segmented control, keyboard-operable; Apply is a clear, focus-ringed button; receipt thumbnails have alt + are keyboard-reachable links; ≥44px Send / Record-payment on mobile; money is tabular; dates in tenant tz (§23); the page reads/prints cleanly at 200% zoom.

## Reject-if self-check
- ✅ Grounded in the as-built (built screen; deltas are restyle/hierarchy/keying, flagged). ✅ Invoice has Project context (links + the project-driven preview). ✅ Henry = the customer-view feedback loop + drift risk-spot, not chat. ✅ No per-seat. ✅ Homeowner never sees this. ✅ Canadian money/Interac present. ⚠ Watch: don't break the §25 preview gate (`draft && !tax_inclusive && project_id`); don't surface margin (preview shows customer prices only); don't re-stack the banners.

## Open questions
- **Keying:** move the visible invoice number off the raw UUID to a friendly # / `approval_code` (coordinated with `customer-documents.md`'s keying pass)? Recommend yes.
- **Details disclosure:** confirm folding defaults-setup + overrides into one "Document details" collapse (vs. leaving inline) reads right for first-time setup.
- **Sent-state editing:** today line edits gate on `isDraft`; confirm sent invoices stay locked (correct) and the only sent action is record-payment / resend / void.
- **Build state:** the screen is functionally built — confirm this is a **restyle-only** dev card (no new behavior), and whether it rides the same OD-fidelity pass as the Billing list/tab.
