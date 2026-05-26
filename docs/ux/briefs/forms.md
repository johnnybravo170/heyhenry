# OD Brief — Forms (cross-cutting pattern: every create/edit form + dialog)

> **Grounded in:** `src/components/ui/input.tsx` · `select.tsx` · `textarea.tsx` · `button.tsx` · `form.tsx`; `src/app/globals.css` (Paper tokens — `--background #f3ebdb`, `--card #fff`, `--border #e2d7c0`, `--input #d8cbb0`, `--ring #0a0a0a`, rust `#c2410c`); exemplar `src/components/features/projects/project-form.tsx` (the New Project screen); the ~40 form/dialog/editor/picker components across `src/components/features/*`; **memory `feedback_form_fields_need_definition`** (inputs must be visually distinct — border/shadow/contrast; same-as-background reads cheap); PATTERNS.md §2 (pick-or-create) · §4 (inline edit) · §5 (action result) · §16 (AI-assisted import) · §22 (tax-split chip).
> **How to use:** this is a **cross-cutting pattern brief, not one screen** — it exists because the redesign restyled *screens* (chrome) but not the **forms/dialogs inside them**, which are visibly pre-Paper app-wide (low-contrast fields, ink-not-rust buttons). Fix the shared primitives once; every form inherits it. Render the **two reference forms** (a short one — New Project; a long one — a Settings form) at desktop + mobile, then `heyhenry-design-critique`.
>
> **⚠ The finding (why "lots of stuff looks untouched"):** the forms aren't un-built — they use the design-system primitives. The defect is at the **token/primitive level**: `ui/input` is `bg-transparent` (field interior = the cream page) with a `--input #d8cbb0` border that's barely darker than `--background #f3ebdb` (warm-on-warm, ~no contrast). So fields don't separate from the page **everywhere at once**. **This is a one-primitive fix that propagates** — not a per-form repaint.

**Object / scope:** every operator **create/edit form** + **dialog** (project · customer · cost-line · sub-quote · change-order · the ~30 Settings forms · the `staged-*` intake dialogs · record-payment · the pickers). **Primary action:** make a form read as *defined, trustworthy, and one-clear-action* — and make that true everywhere by fixing the shared primitives, not each form.

## The two shared fixes (do these first — they carry most of the win)
1. **Field definition (the `ui/input` / `ui/select` / `ui/textarea` treatment).** Give fields a surface that separates from the cream page: **white field interior** (`bg-card`/`#fff`, like the cards float on the paper) **or** a defined inset, **plus a stronger border** (bump `--input` darker than `#d8cbb0`, or add `shadow-xs`). Keep the ink focus ring (`--ring`, already good). The rule (standing feedback): *a field must be visibly distinct from its background — border + contrast + optional shadow.* One change to the three primitives → every form gets definition. Verify the focus/invalid states still read.
2. **Primary-button accent = rust, once.** The live primary `<Button>` renders **ink/black** (`project-form`'s "Create project," the top-right "New Project"). The design system says **rust (`#c2410c`) is the one primary accent**. Reconcile at the primitive: the **primary** Button variant = rust; **secondary** = outline/ghost ink; **tertiary/cancel** = quiet. Then forms use `primary` for the single submit and `ghost`/`outline` for Cancel — no naked black buttons. *(Open Q below: set `--primary` to rust, or add a rust `primary` variant — decide which without recoloring every existing ink button that shouldn't be rust.)*

## Shared form anatomy (the template every form adopts)
- **Header:** title (16px) + one-line purpose; optional **✦ accelerator** card at top (the Henry pre-fill: "Got a quote / photos / voice memo? Drop it in" — `project-form` already has this; standardize it).
- **Fields:** defined label (mono-eyebrow or 14px medium) → **defined field** (the fixed primitive) → help/error line. Group related fields (the 2-up date row). Money via `<Money>`; dates in tenant tz; GST via the §22 tax-split chip where present.
- **Pickers:** contact/customer selection = **pick-or-create** (§2), never a bare select. Inline edits follow the §4 keyboard contract (Enter/Esc/blur).
- **Validation + result:** field-level errors via `status-tokens` danger-soft (label + glyph, not raw red); the `{ ok, error }` action shape (§5) → `toast` on submit; never silent.
- **Actions row:** **one rust primary** (Save/Create/Send) + a quiet **Cancel**; destructive (Delete) is a separate ghost→AlertDialog (§3), never adjacent-equal to the primary.
- **3 type sizes (16/14/12); rust only on the primary + ✦; status via tokens.**

## Component inventory (adopt the template — the "untouched" surface)
`project-form` · `customer-form` · `cost-line-form` · `sub-quote-form` · `change-order-form` / `change-order-diff-form` · `overhead-expense-form` · the **Settings forms** (`business-profile`, `invoicing-defaults`, `operator-profile`, `socials`, `tenant-portal-settings`, + the ~30 `/settings/*` panes) · the **`staged-*` intake dialogs** (bill/document/photo/message) · `record-payment-dialog` · `invoice-overrides-editor` · `selection-form-dialog` · `decision-form` · `portal-update-form` · `assign-workers-dialog` · `clone-project-dialog` · `worker-*-form` · the pickers (`customer-picker(-with-create)`, `selection-photo-picker`, `starter-template-picker`). *(Most just need the primitive fixes + the actions-row + pick-or-create; few need bespoke layout work.)*

## States
- **Empty/new:** placeholder-guided, the ✦ accelerator offered. **Editing:** dirty-state + Save enabled. **Submitting:** disabled + spinner. **Error:** field-level (tokens) + a toast (§5). **Disabled/locked:** (e.g. sent invoice) read-only with the reason.

## Mobile vs desktop
- **Mobile:** full-width stacked fields (drop the 2-up to 1-up), **≥44px** fields + buttons, the submit reachable without scrolling past everything (sticky actions on long forms), native date/select pickers. **Desktop:** the grouped multi-column layout.

## Accessibility
WCAG 2.2 AA: every field has an associated `<label>`; the defined surface must clear AA contrast (field border + text on the new interior); focus ring visible (ink `--ring`); errors announced + tied to the field (`aria-invalid` + `aria-describedby`); ≥44px targets; never colour-only for invalid (glyph + text).

## Propagation / build note
This is **mostly one PR**: fix `ui/input` + `ui/select` + `ui/textarea` (field surface/border) + the `ui/button` primary→rust decision + the relevant `globals.css` tokens, then a light per-form pass for the actions-row + pick-or-create where missing. Update **PATTERNS.md** (a "form anatomy" entry) + **DESIGN.md** in the same change. Recommended Dev card (OD-Driver/Coding lane): **"Form-field definition + button-hierarchy primitive repaint (propagates app-wide)."**

## Reject-if self-check
- ✅ Real primitives/tokens (grounded; the fix is a primitive change, flagged). ✅ Not a 40-form slog — leads with the propagating fix. ✅ Henry = the ✦ accelerator (pre-fill), not a chat. ✅ Rust-once discipline. ✅ Canadian (Money/GST/tz) + ≥44px mobile. ⚠ Watch: the button-variant change must not blanket-recolor *every* ink button to rust — only the single primary per surface.

## Open questions
- **Button:** set `--primary` to rust, or add a distinct rust `primary` variant + reclassify existing ink buttons? (Lean: a rust `primary` variant, so we don't accidentally rust-ify every default button.) — needs a quick design call.
- **Field interior:** white (`bg-card`) vs a faint warm tint vs inset-shadow-only — pick the one that reads "defined" without making forms feel like a wall of white boxes on the warm paper. (Lean: white interior + the existing border bumped slightly — matches "white cards float on paper.")
- **Scope of the first PR:** primitives + tokens + PATTERNS only (fast, propagates), with per-form layout as a follow-up sweep — confirm.
