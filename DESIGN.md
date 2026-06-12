# HeyHenry — Design System v2 "White Ledger"

> Category: Trade Tools
> White ledger, neutral ink, single rust accent. Built for Canadian contractors. Calm and dense — a working tool people stare at six hours a day, not a SaaS demo.
>
> **v2 (June 2026).** Supersedes the warm-paper "Paper" system. Rationale: at full-viewport coverage the cream canvas became a color competing with content, and the mono-caps label tier became wallpaper. A contractor's documents are white; the ledger is now too. **Migration status:** OD renders follow this file immediately (reference render: `od-project-hub/screens/budget-white-v1.html`). App code migrates via the "White Ledger skin + budget recomposition" build card; until it lands, live-app code follows the old tokens in `globals.css` and `tests/unit/design-tokens.test.ts` — both are updated as part of that card, not piecemeal.

## Visual Theme & Atmosphere

A clean printed ledger, not a marketing flourish. Near-white canvas, white cards with hairline borders, black numbers that own the page. Zero generic SaaS feel: no gradients, no 3D blobs, no "AI sparkle." Warmth lives in Henry's voice and the copy — not in painted surfaces. Confident enough to make the call; quiet enough not to celebrate doing so.

## Color Palette & Roles

**Surface**
- **Page background:** `#F8F8F7` — barely-gray warm white (NOT cream; NOT pure white — cards must still float)
- **Sidebar / top bar:** `#FFFFFF` with a 1px right/bottom hairline
- **Active nav item:** `#F0F0EE`
- **Card / surface:** `#FFFFFF`
- **Open-parent row tint (the ONLY in-table fill):** `#F5F5F4`; hover whisper `#F9F9F8`
- **Expansion wells / subtle fills (⌘K chips):** `#FAFAF9`

**Ink** (unchanged from v1 — the ramp was always right)
- **Primary text / primary buttons:** `#0A0A0A`
- **Secondary:** `#3A3A3A` · **Muted:** `#57534B` · **Faint:** `#A8A8A8`
- **Hairline border:** `rgba(10,10,10,0.10)` — on white, alpha hairlines work again
- **Strong rule (section breaks, open-row underscores):** `rgba(10,10,10,0.18)`
- **Containment rails:** category bracket `#AFAFAD` (3px) · line bracket `#D4D4D2` (2px)

**Accent & status** (soft pairs re-tuned lighter for white)
- **Accent (rust):** `#C2410C` / soft `#FEF0E3` — one hero CTA per screen + ✦ Henry + active states
- **OK:** `#15803D` / soft `#E9F9EF` · **Warn:** `#B45309` / soft `#FDF4DC` · **Danger:** `#B91C1C` / soft `#FDECEC` · **Info:** `#1E40AF` / soft `#EEF3FC`
- **Status color appears AT the datum, never as a panel wash.** No full-width tinted alert bands: a status row is white with a colored dot/icon + tinted key phrase (2px colored left rule allowed). Danger rule for money: Remaining < 0 → danger tone on bar AND value.

Never pure black; the page background is never pure white (cards need something to float on).

## Typography Rules

- **One voice: Inter, everywhere.** Weights 400/500/600/700/800; `font-feature-settings: 'cv11','ss01'`.
- **The mono-caps label tier is retired.** JetBrains Mono survives ONLY for literal identifiers (`#a3f2`, ⌘K chips). Never for labels, eyebrows, column headers, or money. **No `text-transform: uppercase` anywhere. No italics anywhere** (notes are regular, muted).
- **Sentence case everywhere.** "Estimated revenue," never "ESTIMATED REVENUE." Labels are 12px / 500 / `#57534B`.
- **Scale (px, closed):** **12 · 14 · 16** body + **20 · 24 · 28 · 36** display. **The 11px tier is retired** along with the mono eyebrows. 13/15 still excluded. Enforced by `tests/unit/design-tokens.test.ts` (updated with the build card).
- **Numbers lead, labels whisper.** A label must never visually outweigh its number. Scorecard/strip values: 20–28px/700 ink; their labels 12px/500 muted.
- **Money:** Inter `tabular-nums`, right-aligned, **cents only at the source-entry tier** ($960.00); every tier above drops them ($2,560). Cents, where shown, smaller + faint. Whole-dollar column alignment is sacred.
- **Hierarchy by tone, not just size** — the ink ramp. 500 is the default UI weight; 600 sub-heads/buttons; 700 names/emphasis; 400 long-form only.
- Line-height 1.5 body, 1.15–1.2 headings; −0.02em tracking on ≥20px headings.
- **Customer-facing floor:** nothing below 12px on portal/(public) surfaces (unchanged).

## Composition Rules (per-screen anatomy)

- **Two objects max above the working table:** a slim **position strip** and **one card**. The page IS the table.
- **Position strip = a ledger sentence, not a scorecard.** e.g. `Estimate $142,000 − Spent $61,300 − Committed $24,800 = Remaining $55,900`: Remaining heaviest; operators muted; color dots on the bar-segment terms make the equation its own legend; 4px stacked bar beneath (empty track = the Remaining tone); minimal chrome (hairline, not a card).
- **No ambient derived stats.** Percentages/ratios render ONLY as exception flags (✦ Henry, soft amber, one line) when the comparison inverts ("53% of work done, 61% of budget spent — running hot"). Healthy = silent.
- **Data chooses the layout, never a mode:** the strip doesn't render until a real dollar exists (Spent+Committed > 0). Pre-approval, the card's ribbon leads.
- **Document state lives ON the document:** the table card's header ribbon carries title + status chip + **the one state-appropriate action, always visible** (Draft → "Preview & send"; Sent → "Mark approved"). Rare actions + tools (Save as template, Collapse all) → ⋯ overflow. **No disabled buttons** — an action appears when it's true.
- **No meta-counts, anywhere.** Never "3 sections · 10 categories," never "4 lines" badges. Chevrons promise depth.
- **Column headers once,** sticky, inside the card. The name column header is **blank** (names self-label; only money columns need labels).
- **No nested cards.** Sections are chapter rows inside the one card (16px/700 name, strong rule above, ~20px air before / ~6px after), never their own bordered cards.

## Table Grammar (the one shading logic)

> **Fills answer "what's active?" Rails answer "what belongs to what?" Indent + type answer "how deep?"** Never let one do another's job.

- **Fills:** exactly two exist in a table — the open-parent row tint and the hover whisper. Nothing else gets a background. Descent quiets monotonically; no level is ever louder than its parent.
- **Brackets (rails):** a containment rail spans the WHOLE container **including its header row** — bracket semantics, not descend-from semantics. Category bracket 3px at the card's left edge, top of the category row → end of its children. Line bracket 2px at the parent's indent, top of the line row → end of its entries. Rails paint above row backgrounds (z-index), never peek through gaps.
- **Hairlines** separate siblings (faintest token, inset to the tier's indent). With fills gone, hairlines + rails carry ALL structure — total white with no rules is a defect, not minimalism.
- **Rows are sized by their tier, not their content:** category ≈ 69px (always two-line height, description or not — no layout jump when one is added), line item ≈ 43px (one line; meta sits inline), entry ≈ 31px. Constant tier heights are what make bracket geometry reliable.
- **Grid discipline:** `column-gap` only — **`row-gap: 0`** on row grids (phantom implicit rows otherwise inflate every row). `align-items: baseline` so money sits on the title's first baseline; icon cells (chevron, grip, actions) get `align-self: center`.
- **Row actions:** edit pencil sits beside the title (its slot space is reserved — no reflow on hover); trash alone in a 24px far-right gutter, outside the money columns. Both hidden at rest, revealed by hover anywhere on the row + `:focus-within`.
- **Remaining column:** value with a 3px bar stacked UNDER it (same number-over-bar grammar as the strip), right-aligned to the column edge. No percentage. Negative → danger on bar + value (reads as a red underline beneath the problem number).
- **Third-tier entries:** faint indented rows on white — no header band, no tinted box, no total footer (the parent's Spent cell is the total). Amounts align into the page's Spent column.
- **Add affordances are scoped, one per level:** dashed "+ Add ‹child›" row inside each container; one page-level add at the bottom. Never two add-buttons side by side.
- **Each tier indents one ~20px step from its parent; sections sit flush left.** The outline shape is the containment cue between section and category — never add a third rail. Brackets mark *open* containers; indent is the resting-state depth cue.
- **Containers never distribute air.** No flex/grid `gap` between structural rows — anonymous spacing reads as unfinished because no element owns it (and it creates unhoverable dead zones). Spacing belongs to the element that means it: chapter rows carry 14px margin above their 2px rule and ~12px padding below it (headings bind downward, snug to their first child); the first section is ruleless, flush under the column band. Reference renders: `budget-flat.html` (flat state) · `budget-sectioned.html` (chapter sections).

## Component Stylings

- **Buttons (primary):** ink `#0A0A0A`, white label, 9px radius, 34px height, 14/600. Default buttons are ink — one-rust-CTA rule below.
- **Buttons (ghost):** white, 1px hairline, ink label. Hover: `#F5F5F4` fill.
- **Buttons (tertiary/add):** transparent, dashed hairline, muted label, 28px — the canonical dashed-add affordance.
- **Cards:** white on `#F8F8F7`, 12–14px radius, 1px `rgba(10,10,10,0.10)` border, shadow `0 1px 2px rgba(10,10,10,0.04)`.
- **Inputs:** white, 1px hairline, 9px radius, 34–36px; visible border always (same-as-background fields read cheap). Focus: 2px low-chroma ink ring.
- **Tables:** per Table Grammar above. No zebra, ever.
- **Badges / status pills:** soft-pair fills, sentence case ("Active", "Draft"), dot prefix for live states.
- **Sidebar nav:** white, hairline divider, active item `#F0F0EE`, badge counts as calm ink pills (count = items awaiting action; zero = no badge; cap "9+"). Rust pill only where the item is genuinely Henry-urgent.
- **Links:** ink weight-600 (sentence case — the uppercase-mono link style is retired) or inline blue `#1E40AF`.

## Layout Principles

- **Shell:** 228px white sidebar, sticky white top bar, content scrolls. Content width 1280px tables / 720px forms / 640px prose. Gutters 24–28/16/12.
- **Density over whitespace drama** — but density through tight tiers and hairlines, not through chrome.
- **"Edit where you look"** — inline editing on the data the eye is on.
- **Power-user paths first** — keyboard, bulk, expand/collapse all.

## Depth & Elevation

- **Flat (0):** default. **Raised (1):** dropdowns/popovers/dialogs — `0 2px 16px rgba(10,10,10,0.06)`.
- No neumorphism, glassmorphism, hard shadows, or inner input shadows.

## Do's and Don'ts

- ✅ One ink, one accent. **Exactly one rust hero CTA per screen**; rust otherwise = ✦ Henry, active states, inline accents.
- ✅ Tabular numerals; right-aligned money; cents only at entry tier.
- ✅ Status at the datum via soft pairs. Exception flags over ambient stats.
- ✅ Real touch targets (44px+). Contractors use the app from a truck.
- ✅ When in doubt, subtract — then make sure hairlines/rails still carry the structure you removed.
- ❌ No cream/tan surfaces (`#F3EBDB` family is retired). No mono-caps labels. No 11px type. No italics.
- ❌ No full-width tinted alert bands. No legends restating visible numbers. No disabled buttons. No meta-counts.
- ❌ No dark-slab navigation. No purple gradients / 3D blobs / AI-sparkle.
- ❌ Never "HH" — always "Henry" / "HeyHenry." No per-seat framing in pricing UI.
- ❌ No more than three type sizes on one screen.
- ❌ Don't make Canadian a footnote (CAD, T5018, WSIB, GST/HST, real place names).

## Responsive Behavior

- **Desktop ≥1024:** full sidebar + shell, 12-col. **Tablet 768–1023:** 64px icon rail, 8-col. **Phone <768:** bottom tab bar or hamburger, single column, tables → stacked cards, 44px+ targets. Hover-revealed row actions surface in the row's expanded state on touch.

## Agent Prompt Guide

- A working tool for contractors. Scan-ability and density over decoration. **When in doubt, subtract.**
- **Don't invent hex values** outside this palette; use the closest token and note the substitution.
- **Audience language:** "GC, sub, tile guy, reno contractor" — never "home service professional." Canadian forms (T5018, WSIB, GST/HST). Vocabulary per the Ops vault taxonomy decision: invoice = sent to client; bill = received; costs follow the job; overhead keeps the lights on; never "procurement," "scope item," or "budget line."
- **Copy voice (Henry):** short, direct, decision-attached. Vocabulary above is binding for Henry too.
- **Tagline** "Add a guy. Not a subscription." remains UNDER REVIEW — worldview yes, those five words no.
- **Henry is the guide, never the hero.**
- Brand context: `/Claude/heyhenry-brand/heyhenry-brand-package.md`. Product foundation arrives per-screen in the design brief (`docs/ux/briefs/`); foundation docs index: `docs/ux/README.md`. This file is the visual system — design to the brief.
