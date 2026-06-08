# HANDOFF — OD design → React/Next implementation

*The contract between the design agent (OD HTML in `od-*/`) and the building agent (Next 16 / Tailwind v4 / shadcn in `src/`). Read this before you ship a new OD screen into the app — or before you start building one.*

---

## The problem this doc solves

The OD render loop produces pixel-accurate, opinionated HTML. When a building agent works from a **screenshot** of that render, every load-bearing detail is lost:

- design tokens (`--rust`, `--rust-soft`, `--ink-2`) collapse to hex guesses
- component class names (`action-tile.is-overdue`, `ar-strip`, `tab-count-danger`) vanish
- status soft-pair palette intent gets re-derived from the pixel
- data bindings (which number is `Outstanding`, which list is "overdue draws") are inferred
- a11y attrs and 44px hit-target discipline disappear
- sticky/clip overflow tricks (the desktop schedule's day-axis `overflow: clip` trick) read as visual coincidence

The build comes out drifted, error-prone, and slow. The design *already exists as code* — the build is a **translation table** from `:root` tokens + class names to Tailwind tokens + React components. Treat it that way.

---

## The handoff contract — three artifacts, always together

When an OD screen is ready to enter the build, the design agent ships **three** things in one change:

1. **The OD HTML file** (`od-<feature>/screens/<screen>.html`) — already committed; this is the canonical source, not a screenshot of it.

2. **A `.build.md` sidecar punch list** next to the HTML (`od-<feature>/screens/<screen>.build.md`) — the build instructions, see template below.

3. **A `PATTERNS.md` entry** for every new primitive — the catalog is the contract; the building agent walks `PATTERNS.md → src/components`, not `screenshot → guess`.

If any of the three is missing, the handoff is incomplete. Don't start building.

---

## The `.build.md` sidecar — template

Save next to the HTML file. Keep it short — punch-list form, not prose.

```markdown
# Build: <screen name>

**OD source:** `od-<feature>/screens/<screen>.html`
**Real component target:** `src/components/features/<feature>/<component>.tsx`
**Route/parent:** `src/app/(dashboard)/<...>/page.tsx`

## Open questions
- [ ] <unresolved question that blocks the build>

## Token additions (paste into `src/app/globals.css` + `tailwind.config`)
```css
:root {
  --rust-soft: #FEF0E3;   /* new */
  --ink-2:     #3A3A3A;   /* new */
}
```

## New component primitives
| OD class | shadcn variant target | New / extend |
|---|---|---|
| `action-tile.is-overdue` | `<Button variant="actionTile" tone="danger">` | new variant |
| `ar-strip`               | `<Alert variant="info" size="pill">`         | new size on existing Alert |
| `tab-count-danger`       | `<Badge tone="danger">`                       | extend tones |
| `method-chip.is-stripe`  | `<Badge tone="info" leading={<StripeIcon/>}>` | reuse |

For each NEW recipe: copy the CSS verbatim from the OD file's `<style>` block. Don't re-derive. Tokens go to globals.css.

## Data bindings (every visible number/string → source)
| Visible | Source |
|---|---|
| `Contract` $142,000 | `getVarianceReport(projectId).estimated_cents + Σ approved CO totals` |
| `Billed` $67,200    | `Σ invoices.total_cents where status in ('sent','paid')` |
| `Paid` $56,000      | `Σ invoices.total_cents where status='paid'` |
| `Outstanding` $11,200 | `Billed − Paid` (derived; no column) |
| `Remaining to bill` | `Contract − Billed` (derived) |
| `Overdue $11,200 · 1` | `count + Σ where status='sent' && sent_at > now()-14d` |
| `Ready to bill $11,760` | `lib/billing/ready-to-bill.ts` (existing) |

## Server actions / mutations used
- `setProjectDrawGstModeAction` (existing, `src/server/actions/project-cost-control.ts`)
- `createInvoiceFromEstimateAction` (existing)
- `generateFinalInvoiceAction` (existing)
- NEW: `markInvoicePaidAction(invoiceId, method)` — does not exist yet, must be created

## A11y notes
- Status NEVER colour-only — every pill carries label + glyph + tone (e.g. `Overdue · ⚠ · 7d`)
- Hit targets ≥ 44px on mobile; verify on the action tiles
- The Outstanding / Overdue / Ready-to-bill figures are real `<button>` / `<a>` elements that route to a filtered view — not decorative `<div>`s

## What changed since last handoff
*(only relevant on re-handoffs)*
- AR strip width: full-width → `inline-flex` pill (sized to content)
- Tab badge title now reads "1 overdue draw" (was generic)
```

---

## Token parity discipline

OD `:root` values must match the app's `globals.css` + `tailwind.config` exactly. When OD introduces a new token, it lands in **both** places in the same change.

```
od-<feature>/screens/<screen>.html  :root --rust-soft: #FEF0E3
src/app/globals.css                  :root --rust-soft: #FEF0E3
tailwind.config.ts                   theme.extend.colors['rust-soft']: 'var(--rust-soft)'
```

If a building agent ever has to "match a color from a screenshot", parity has broken — fix the token map, don't eyeball.

---

## `PATTERNS.md` update — same change, not later

Every new primitive added to an OD screen gets a row in `PATTERNS.md` **in the same commit** as the OD file lands. Don't defer. The catalog is what the building agent (and you, three weeks from now) walk to find the right primitive.

A `PATTERNS.md` entry looks like:

```markdown
### Action tile (`.action-tile.is-overdue` / `.is-ready`)
Real-button summary figure inside a card. Two tones:
- `is-overdue` — danger-soft fill, used for the single actionable money figure (Outstanding/Overdue).
- `is-ready` — peach (rust-soft), used for the Henry Ready-to-bill nudge anchor.
At most one per card; never both flavours adjacent.

Sibling instances: `od-project-hub/screens/desktop-billing.html` line 980, `mobile-billing.html` line 415.
Real-app target: `<Button variant="actionTile" tone="danger|ready">` — new variant TBD.
```

---

## What the building agent does on receipt

When a building agent picks up a `.build.md` sidecar, the flow is:

1. **Read the OD HTML first.** It's the canonical source. Don't open the screenshot.
2. **Diff token additions against `globals.css` + `tailwind.config`.** Add missing tokens before writing any component code.
3. **For each component primitive in the punch-list table:** check `PATTERNS.md` for the recipe; map to an existing shadcn variant if listed; only create a new variant if the table says "new".
4. **Build the data layer first** (queries / server actions in the table) — if a binding doesn't exist, create it and verify with a unit test before wiring the UI.
5. **Wire the UI** matching class names + behavior from the OD HTML. JS interactions (toggles, drawers, modal opens, sticky day-axis with `overflow: clip`) are spec'd in the OD HTML — copy the approach, don't re-derive.
6. **Verify against the OD HTML in a side-by-side browser preview**, not a screenshot.
7. **Update `PATTERNS.md`** with the real-app file path once the component lands.

If the build agent finds itself opening a `.png` or `Screenshot-*.png` file to inform a build decision, **stop and surface it** — the handoff bundle is incomplete or being misused.

---

## Cost of this discipline

~5 minutes per new primitive at the end of an OD session — the sidecar + PATTERNS row. In exchange:

- The build pass is deterministic — no eyeballing, no drift.
- New primitives are catalogued — they get reused in the next screen, not reinvented.
- Three weeks from now, you can pick up where you left off without re-deriving intent from pixels.

The screenshot loop pretends design lives in pixels; this protocol treats design as code that already mostly exists, and the build as a translation.

---

## Reference — what already exists in this repo

- **OD renders** committed at `od-<feature>/screens/{desktop,mobile}-<screen>.html` (see `docs/ux/HANDOFF.md` for the full list).
- **Real-app primitives** catalogued in `PATTERNS.md` (repo root).
- **Design tokens** live in `DESIGN.md` (spec) + `src/app/globals.css` (CSS vars) + `tailwind.config.ts` (Tailwind aliases).
- **The screen briefs** at `docs/ux/briefs/*.md` capture the *intent* — what to design and why. The OD HTML is the *spec* — what to build pixel-for-pixel. The `.build.md` sidecar is the *contract* — what the build agent must produce.
