# HeyHenry

> Category: Trade Tools
> Warm paper canvas, neutral ink, single rust accent. Built for Canadian contractors. Calm and dense — a working tool people stare at six hours a day, not a SaaS demo.

## Visual Theme & Atmosphere

A working tool, not a marketing flourish. One continuous warm field — paper everywhere — with white cards floating on it like documents on a workbench. Zero generic SaaS feel: no gradients, no 3D blobs, no "AI sparkle." Confident enough to make the call; quiet enough not to celebrate doing so. Trade-credible in Toronto or Texas.

## Color Palette & Roles

Surfaces carry warmth; ink stays cool-neutral so the two never fight.

**Surface**
- **Page background:** `#F7F5F0` — warm paper
- **Sidebar / top bar:** `#FBFAF6` — slightly *lighter* than body (deliberate; documents float on paper, chrome doesn't darken the field)
- **Active nav item:** `#EFECE4` — deepest cream
- **Card / surface:** `#FFFFFF` — pure white
- **Subtle fill (⌘K chips, etc.):** `#F1EFE9`

**Ink**
- **Primary text / primary buttons:** `#0A0A0A` — near-pure black, neutral (NOT a warm charcoal)
- **Secondary text:** `#3A3A3A`
- **Muted (captions, inactive nav):** `#6B6B6B`
- **Faint (placeholders, disabled):** `#A8A8A8`
- **Hairline border:** `rgba(10,10,10,0.08)`
- **Rule border:** `rgba(10,10,10,0.12)`

**Accent & status** (each color has a soft-fill pair for badges/banners)
- **Accent (rust):** `#C2410C` / soft `#FEF0E3` — CTAs, brand pop, one accent per screen
- **OK:** `#15803D` / soft `#DCFCE7`
- **Warn:** `#B45309` / soft `#FEF3C7`
- **Danger:** `#B91C1C` / soft `#FEE2E2`
- **Info / blue:** `#1E40AF` / soft `#E6EDFA`

Use rust sparingly — it earns attention precisely because everything around it is calm paper and neutral ink. Never pure black; never pure white as a page background.

## Typography Rules

- **Sans (everything):** `'Inter', system-ui, -apple-system, sans-serif`; weights 400 / 500 / 600 / 700 / 800; `font-feature-settings: 'cv11', 'ss01'` on body
- **Mono:** `'JetBrains Mono', ui-monospace, monospace`; weights 500 / 600 / 700 — used as a *labeling device* (small uppercase eyebrows over data: "SCHEDULE", "REMAINING"), numeric columns, ⌘K chips. Not for body.
- **Scale (px):** 11 · 12 · 13 · 14 · 16 · 20 · 28 · 36
- **Line-height:** 1.5 body, 1.15–1.2 headings
- **Letter-spacing:** −0.02 to −0.025em on headings ≥20px; tight (≈ −0.005em) on body
- **Numerals:** `font-variant-numeric: tabular-nums` on every money or metric value. Right-align numeric columns.

## Component Stylings

- **Buttons (primary):** ink fill `#0A0A0A`, white label, 9px radius, 34px height, 12px padding-inline, font 13/600. Hover: lift to `#222`.
- **Buttons (ghost):** white surface, 1px hairline border, ink label, 9px radius, 34px height. Hover: subtle cream fill, slightly darker border.
- **Buttons (tertiary):** transparent fill, dashed hairline border, muted label, 28px height — for "add row" affordances inside tables.
- **Cards:** pure white on paper bg, 12–14px radius, 1px hairline border, no shadow by default. Section cards have a header bar with rolled-up metrics.
- **Inputs:** white surface, 1px hairline border, 9px radius, 34–36px height. Focus: 2px ring in ink with low chroma.
- **Tables:** hairlines between rows, no zebra. Right-aligned tabular numerals for money/quantity. De-emphasize cents (smaller, muted) in currency columns.
- **Badges / status pills:** soft-fill pair only — `warn` text on `warnSoft`, never a heavy amber block. Dot prefix for live states ("• Active").
- **Sidebar nav:** paper bg lighter than body, active item filled with `#EFECE4` (no border-left indicator), bold label on active. Badge counts in rust pill.
- **Top bar:** paper bg, sticky, includes search (with ⌘K chip), inline log-time / log-expense ghost buttons, primary New action, org switcher on the right.
- **Links:** ink with weight 600 + uppercase + mono for "see more" style; or blue (`#1E40AF`) for inline body links. Hover transitions to ink.

## Layout Principles

- **Shell:** 228px fixed sidebar (paper), sticky top bar (paper), main content scrolls.
- **Content width:** 1280px max for dashboards/tables, 720px for forms, 640px for prose.
- **Gutters:** 24–28px desktop, 16px tablet, 12px phone.
- **Density over whitespace drama.** This is a working tool. Add a metric column instead of an illustration.
- **Cards are the grouping primitive.** Sections are cards with a header bar (label + rolled-up totals + section health bar).
- **"Edit where you look"** — clickable inline editing on data the eye is on. Don't make users navigate to an edit page to change a date or amount.
- **Power-user paths first.** Keyboard shortcuts, bulk actions, expand/collapse all. The contractor will get fast at this.

## Depth & Elevation

Two levels only:
- **Flat (0):** default — paper canvas, white cards, hairlines do the separating.
- **Raised (1):** dropdowns, popovers, dialogs — soft, low shadow: `0 2px 16px rgba(10,10,10,0.06)`.

No neumorphism, no glassmorphism, no hard drop shadows, no inner shadows on inputs.

## Do's and Don'ts

- ✅ Let scan-ability rule. Dense over decorated.
- ✅ One ink, one accent. Use rust for CTAs only.
- ✅ Tabular numerals on every money/metric. Right-align numeric columns. De-emphasize cents.
- ✅ Status through soft-pair colors (`warn` on `warnSoft`), never heavy fills.
- ✅ Inline editing where the eye is. No "go to edit page" round-trips.
- ✅ Real touch targets on mobile (44px+). Contractors use the app from a truck.
- ❌ No dark-slab navigation. The sidebar and top bar are paper, not charcoal.
- ❌ No purple gradients, no 3D blobs, no AI-sparkle iconography, no "Generated by AI ✨" badges.
- ❌ No per-seat framing in pricing UI. Tiers lead with buyer intent, not seat-count selectors.
- ❌ Never the abbreviation "HH" anywhere. Always "Henry" or "HeyHenry."
- ❌ No more than three type sizes on one screen.
- ❌ Don't make Canadian a footnote — it's texture (CAD, T5018, WSIB, real place names like Abbotsford / Chilliwack / Langley).

## Responsive Behavior

- **Desktop ≥ 1024px:** Full sidebar (228px) + content shell. 12-col content grid.
- **Tablet 768–1023px:** Sidebar collapses to 64px icon rail. 8-col grid, 16px gutters.
- **Phone < 768px:** Sidebar becomes a bottom tab bar (5 primary destinations max) or a hamburger overlay. Single-column content. Tables degrade to stacked cards. 44px+ touch targets everywhere.

## Agent Prompt Guide

- HeyHenry is a working tool for contractors, not a marketing site. Favor scan-ability and information density over decoration.
- **When in doubt, subtract.** Fewer boxes, less chrome, more density. Replace illustrations with metrics.
- **Don't invent hex values** outside the palette above. If a request seems to need one, use the closest existing token and surface a comment in the artifact noting the substitution.
- **Audience language:** contractors call themselves "GC, sub, tile guy, reno contractor" — NEVER "home service professional." Use Canadian forms (T5018 not 1099, WSIB, GST/HST not state sales tax).
- **Copy voice (Henry):** short, direct, decision-attached. "Got it. Quote's drafted — want me to send it now, or hold for review?" Never "Hi! I'd be happy to help you draft a quote! ✨" or "I noticed your customer Mike has an outstanding balance…"
- **Tagline:** The slogan "Add a guy. Not a subscription." is UNDER REVIEW. Do not set type around it. The *worldview* (flat per-business pricing; hire crew, not pay more per seat) stands and can be expressed in copy — just not those exact five words yet.
- **Henry is the guide, never the hero.** The contractor is the hero. Don't build screens that celebrate Henry — build screens that let the contractor look competent.
- Brand context (voice, character, hero archetypes, imagery direction) lives in `/Claude/heyhenry-brand/heyhenry-brand-package.md`. Don't reproduce it here; consult it when uncertain.
- **Product foundation** (objects, workflows, roles, IA, positioning) is *not* in this file — it arrives **per-screen in the design brief**. Canonical foundation docs live in the Ops knowledge vault; the index is `docs/ux/README.md`. This file is the visual system — design to the brief.
