---
name: heyhenry-visual-qa
description: Review a RENDERED HeyHenry screen (a live-app screenshot, or a batch of them) for visual / layout / render defects — overlap & z-index bleed, off-palette or loud colour, rust over-use, typography drift, mobile width blowout, clipped actions, cramped or broken layout — judged against HeyHenry's calm "Paper" system the way the non-technical owner would, and emit before/after + plain-English findings batched for one review. Use for visual QA, screenshot review, render-defect or visual-regression checks, "does this look right / look good," or to drive the autonomous visual-QA sweep. Distinct from heyhenry-design-critique, which judges workflow / positioning / object-model fidelity (concepts), NOT pixels.
---

# HeyHenry Visual QA — the render-defect lens

Look at a **rendered screen** (a screenshot of the live app) and judge whether it *looks right* — overlaps, off-palette colour, clipped actions, cramped or broken layout — the way Jonathan (the non-technical owner) would. This is the **perceptual** lens.

Its sibling `heyhenry-design-critique` judges workflow / positioning / object-model fidelity — concepts, not pixels. Run that one for "is this the right screen"; run **this** one for "does it render right," for visual-regression sweeps, or to drive the autonomous visual-QA loop.

**Work from pixels, not the DOM.** A defect is what a person sees, not what the code says.

## Calibration — file early, file often

**PASS is rare. One defect is enough to file the screen.**

If you can name **a single** issue from the checklist on a screen — even one you'd call "minor" or "borderline" — the screen is **not PASS**. It's a digest entry, captured with a before screenshot and a plain-English caption. The whole point of the loop is to surface what Jonathan would catch by eye; a lenient grader that swallows "small" defects is worse than no grader, because it launders broken screens as approved.

Defects do not need to compound. Do not bundle issues mentally and ask "is this *bad enough* to file?" — the answer is yes the moment you can name one.

Specifically:
- "Borderline low contrast" → file it.
- "Minor banner-to-content spacing" → file it.
- "Cards look a bit empty / a bit cramped" → file it.
- "Two cards on this row say the same thing" → file it.
- "AWAITING APPROVAL is yellow, the others are white — probably intentional?" → file it. Let Jonathan decide; don't pre-rule.

A sweep where every screen is PASS is almost always a calibration failure, not a clean app. When in doubt, file.

## The HeyHenry baseline — what "right" looks like
A **calm, dense working tool** on a warm "Paper" system: cream surfaces, white cards, near-black ink, and exactly **ONE rust accent** (`#C2410C`) reserved for the single primary "decide" CTA + the ✦ Henry mark. Money is tabular and right-aligned. Status reads as **glyph + word**, never colour alone. Type is a tight 16/14/12 ramp in medium-weight Inter.

These are defects in themselves (not just "taste"):
- Looks like **generic SaaS / stock-shadcn grayscale**, or has **gradients, glows, or AI-sparkle** decoration.
- **Loud saturated colour blocks** (solid red/amber/emerald/blue) instead of soft Paper tones.
- **More than one rust** element competing, or rust on anything but the one decide-CTA / ✦ Henry mark.

**Tuning note:** the typical HeyHenry failure is **cramming + off-system decoration** at the page level, but **void *inside* card chrome is the second-most-common defect** — a stat card where the number floats in oversized space, an empty intelligence strip rendering empty chrome. Don't let "weight cluttered over sparse" become cover for ignoring oversized-card voids. Two distinct void modes, both worth filing: (a) **page-level void** — a big empty band where a section is half-built (rare); (b) **card-level void** — a card whose content uses ≲ 50% of its footprint (common, and easy to miss). **And evaluate spacing/rhythm *between* sections, not just within cards** — insufficient vertical gap between stacked bands (banner → card row → panel) is an easy miss and a real defect; scan the page's vertical rhythm explicitly, top to bottom.

## Universal design principles (the general eye)
The HeyHenry rules above are the house style; these are the universal principles beneath them — the "why" that catches defects no past-bug list anticipated. **When they conflict with the house style, the house style wins** (HeyHenry is deliberately dense, so "generous whitespace" means *rhythm and grouping*, not sprawl).

**Refactoring UI (Wathan/Schoger):**
- **Group with space — more space *between* groups than *within* them.** Equal or insufficient spacing makes unrelated things read as related, and related things as unrelated. (This is the vertical-rhythm rule, generalised.)
- Hierarchy comes from **weight and colour, not size alone**; deliberately de-emphasise secondary content.
- Spacing rides a **constrained scale** (4/8/12/16/24/32/48/64) — stray values (13px, 17px) are a smell.
- **Design in greys first**; colour is the last layer, reserved for meaning and action.

**Gestalt (the perception underneath):**
- **Proximity / common region** — nearness and shared containers signal grouping; the spacing rules above just exploit this.
- **Figure / ground** — the foreground must separate cleanly from what's behind it; a menu the background bleeds through is a figure/ground failure (→ the overlay-bleed class).
- **Similarity / alignment** — like things should look alike and line up; ragged or mixed treatments read as broken.

## Capture protocol
- Drive the **Maple Ridge Renos** demo tenant (GC/renovation, `is_demo=true` so email/SMS are suppressed) at app.heyhenry.io. Credentials live in the Ops knowledge vault ("QA tenant credentials").
- **Sweep every variation:** phone, tablet, and desktop-cockpit widths, in **light mode always** and **dark mode once it's live** (the `.dark` tokens exist but the theme switch may not be wired yet — skip dark only if the app renders light-only). Phone is the non-negotiable one (contractors work from the truck), but no variation is "optional."
- For every finding, capture **before**; after a fix, capture **after** at the same route + viewport. The before/after pair IS the review artifact.
- **Measure vertical rhythm, don't eyeball it.** A too-small gap between stacked sections does NOT pop in a screenshot the way a loud colour does — it is the single easiest defect to miss by eye. So make it a DOM measurement, the same way colour claims get `getComputedStyle`: for each page, walk the top-level stacked blocks (banner → triage row → panel → list …) and read the **computed pixel gap between each adjacent pair** (`b.getBoundingClientRect().top − a.getBoundingClientRect().bottom`). **Flag any adjacent pair separated by `0px`, or by noticeably less than its sibling gaps** (e.g. two groups touching while everything else has 24px between it). A `0px` gap between two distinct card groups is a confirmed "cramped vertical rhythm" finding — file it. Common root cause: a section component returns a **bare React fragment** of stacked cards into a slot whose wrapper sets no `gap`/`space-y`, so the cards butt together at 0px (see the dashboard `attention` section). Run this measurement on every swept route; "the page looked fine" is not a pass for vertical rhythm.

## The checklist (grouped)
Each line: **what to look for** · "plain-English caption" · [auto-fix | surface].

### 1 · Mobile & overflow
- **Grid blowout** — on phone, cards sit side-by-side and squeezed, or run under the right edge / the page scrolls sideways · "On my phone the boxes don't stack into one column, and the page slides sideways." · [auto if one card; surface if many]
- **Flex truncate blowout** — a long name / email / URL pushes the row past the screen instead of ending in "…" · "A long name runs off the edge instead of getting cut short with a '…'." · [auto]
- **Table sideways-scroll leak** — a wide table scrolls the *whole page* sideways instead of scrolling inside its own frame · "The budget table makes the whole page slide sideways instead of scrolling inside its box." · [surface]
- **Touch targets too small** — buttons / rows smaller than a fingertip (~44px; field surfaces want 48–64px), packed tight · "The buttons are too tiny to tap with a thumb." · [auto]

### 2 · Dialogs & modals
- **Clips the primary action** — a tall popup cuts off the Save / Submit button at the bottom with no way to scroll to it · "The Save button at the bottom of the popup was cut off — I couldn't reach it." · [surface if the base dialog primitive; auto if one caller's stray override]
- **Dialog scrolls sideways** — a popup shows a stray horizontal scrollbar / shifts left-right · "The popup scrolls sideways for no reason." · [surface if the primitive]
- **iOS bottom-chrome clip** — on iPhone, the bottom buttons tuck behind Safari's address bar · "On my iPhone the bottom buttons hide behind the browser bar." · [auto]
- **Native confirm/alert** — a bare grey OS popup instead of the app's styled dialog · "A plain grey system pop-up appeared instead of one that matches the app." · [auto]

### 3 · Colour, accent & contrast
- **Off-palette loud colour** _(MOST COMMON)_ — solid saturated red/amber/emerald/blue blocks or raw Tailwind colours instead of soft Paper tones · "This banner is a loud solid block that clashes with the calm cream-and-ink look." · [auto if one component; surface if it needs token edits]
- **Rust over-use** _(COMMON)_ — more than one rust element, or rust on a progress bar / secondary button / generic header · "Too many orange things are shouting at once — orange should be on just the one main button." · [surface — needs whole-screen judgment]
- **Colour-only status** — a pill / dot / tinted row conveys meaning by colour with no word or icon · "I can't tell what the coloured tag means — there's no word or icon." · [auto if one badge; surface if from `status-tokens`]
- **Low-contrast mush** — faint grey text on cream; headings/captions that don't separate; vanished hairlines/dividers · "The grey text is too faint to read, and the lines between rows have basically vanished." · [surface if a token; auto if one label]
- **Form fields blend into the background** — text inputs / selects / textareas with the same fill as the page or card behind them and no border or shadow to define the box; reads cheap and unfinished · "The input boxes are the same colour as the background — you can't tell where to type, and it looks cheap." · [surface — usually the shared input primitive or a token]

### 4 · Typography
- **Type drift** _(MOST COMMON)_ — more than three sizes competing; thin/default body instead of medium; an off / semi-italic display font · "The text looks inconsistent — too many sizes, and the font feels flimsy/off." · [surface if global fonts/tokens; auto if one stray size]

### 5 · Stacking & sticky
- **Overlay / z-index bleed** — a dropdown / popover / tooltip / sticky header renders *behind* what it should sit above, or the background shows through it · "The dropdown opened *behind* the box instead of on top." / "The menu has the background bleeding through it." · [auto if one feature component; surface if it touches the dialog/overlay primitives]
- **Sticky misbehaving** — a column header / toolbar / pay-bar that should stick scrolls away, double-renders, or covers the wrong region · "When I scroll, the column titles disappear so I lose track of which number is which." · [surface if non-obvious]

### 6 · Layout & space
- **Misalignment / padding** — money not right-aligned / cents full-size; nested rows on ragged left edges; uneven gutters between sibling cards; **outer/container padding not enforced, so cards run flush to the edge or up against the scrollbar** (some cards have margin, others look cut off — "broken" spots) · "The boxes don't line up, and some are jammed right against the edge of the screen so it looks broken." · [auto if one container's padding; surface if it's the grid/layout shell]
- **Stacked-banner pile-up** — 3+ separate coloured banners crammed above the content, burying the task · "A pile of warning boxes at the top — overwhelming, can't find the main thing to do." · [surface — layout-architecture]
- **Void / cramming** — a box far bigger than its sparse content (rare), OR content jammed edge-to-edge with no breathing room (common); an empty intelligence strip rendering empty chrome · "This box is huge but nearly empty." / "Everything's jammed together with no space." · [surface — judgment]
- **Stranded dead zone (poor action layout)** — a large empty band created by action buttons stacked or parked in a corner instead of laid out efficiently or folded into the adjacent header · "There's a big dead area here — these buttons are stacked in the corner instead of using the space." · [surface — layout decision]
- **Cramped vertical rhythm (section spacing)** — stacked sections (banner → card row → panel) butting together with little or no vertical gap; no consistent breathing room down the page · "The sections are stacked right on top of each other with no space between them — it feels cramped." · [auto if a one-off margin; surface if it's the page-shell spacing scale]
- **Collapsed container** — a region that should fill its row renders as a short broken stub (e.g. calendar cells collapsing) · "The calendar cells are short broken boxes instead of filling the row." · [surface if non-obvious]
- **Truncation collision / wrap** — a short pill/label wraps to two lines, or text jams against a neighbour · "The status tag is awkwardly split across two lines." · [auto]
- **Card-content density mismatch** — a card whose label + value + caption occupy less than roughly half of the card's footprint, leaving a big empty bottom band inside the card; numbers float in oversized boxes · "The number is small and floats in a big mostly-empty box — the card feels oversized for what's in it." · [surface — sizing decision]
- **Unlabelled / unframed stat row** — a row of stat cards sitting under another row with no section heading and no extra vertical gap, so the two rows read as one ragged grid instead of two related sections · "Two rows of number-boxes stacked together with no heading on the second one — it looks like one broken grid." · [surface — layout-architecture]

### 7 · Data & stability
- **Raw / unformatted data** — a UUID shown as an invoice number, a raw ISO date, an unformatted phone, a literal HTML entity, a date off by a day · "The invoice number is a jumble of letters; the date shows 2026-04-28 instead of Apr 28." · [auto — match the tenant-tz date helper]
- **Hydration flicker** — content flashes / jumps / relayouts on load then snaps to a different layout · "The page flickers and jumps as it loads, then settles into a different layout." · [auto — follow the overlay-link / server-stable-time pattern]

### 8 · Components & states
- **Missing interactive / feedback states** — a button with no hover or active state, an input with no visible focus ring, or a clickable thing with no affordance (doesn't look clickable) · "This doesn't look clickable, and nothing changes when I hover or tap it." · [auto if one component; surface if the shared button/input primitive] _(may need a hover/interaction pass, not just a static shot)_
- **Poor empty / loading / error state** — a blank region with no empty-state message, a layout that pops/shifts with no skeleton while loading, or a raw unstyled error · "When there's nothing here, or it's loading, the screen looks broken instead of telling me what's going on." · [auto if one surface; surface if a shared state pattern]
- **Consistency drift** — mixed border-radii, inconsistent shadow/elevation, two button styles for the same action, or mixed icon styles (outline + filled) on one screen; also includes one card in a row with a different fill colour than its siblings with no clear status reason · "Things that should match don't — corners, shadows, fills, or buttons differ across the screen." · [surface — usually a token or primitive]
- **Redundant metric** — the same number/entity is rendered twice on one screen in two card framings (e.g. "ACTIVE 7" and "ACTIVE PROJECTS 7" both visible at once), making the viewer bounce between them wondering if they're the same thing · "Two boxes on the same page are showing the same number — am I supposed to read them as different?" · [surface — object-model decision, needs `heyhenry-screen-design`]

## Output — what a finding looks like
Per defect: **before/after screenshots** + a **plain-English caption** + the **risk tag** ([auto-fix] or [surface]).

**Caption the pixels, not the patch.** Describe the symptom and the fix from what a person *sees* — "the Save button was cut off; it's reachable now" — never the CSS ("added `min-w-0`", "moved z-index").

**Batch every finding from a sweep into ONE review digest** — a gallery of before/after pairs with captions, approve-as-a-batch, flag the odd one out. **Never** emit a pile of granular technical approvals ("approve moving the z-index?") — that recreates the exact slowdown the loop exists to remove. Calm cadence: a sweep → one digest, not per-fix pings.

## The auto-fix gate
- **Safe to auto-fix on a PR (small / localized):** flex-truncate blowout, iOS dvh clip, native-confirm swap, truncation-wrap, raw-data formatting, single-instance grid/colour/touch-target, pattern-following hydration fix.
- **Surface to Jonathan (shared primitive / design token / many siblings / judgment):** dialog-primitive fixes, the table-scroll convention, `status-tokens` / `Money`, `globals.css` colour/contrast/type tokens, form-field definition (input primitive/token), rust judgment, stranded dead zones & outer-padding/grid-shell, stacked-banner & void layout-architecture, stacking / sticky / collapsed-container.
- Everything auto-fixed still lands as a **PR Jonathan merges** — the gate only decides *attempt vs. surface*, never *ship without him*.

## Keeping the lens current
This checklist is mined from the real fix-history; it's **iterative**. Every new defect Jonathan flags becomes a new line here — that's the mechanism for "look at it the way I look at it." When a sweep misses something he catches by eye, add the class (what to spot · plain-English caption · risk tag).

## Foundations (what the general eye is built on)
- **Refactoring UI** (Wathan/Schoger) + **Gestalt** — the universal-principles layer above.
- Cross-checked against the community **`ui-design-review`** skill (mastepanoski/claude-skills). Most of its ten dimensions we already cover; harvested the three we didn't — component states, empty/loading/error, consistency drift (group 8). Vetted clean: no injected instructions (it even models good untrusted-input handling). Treated as a source, not installed.

## Related
- `heyhenry-design-critique` — the conceptual sibling (workflow / positioning / object-model fidelity). Run it for "is this the right screen," this one for "does it render right."
- Feeds the autonomous QA loop: the detector grades screenshots against this checklist; the fixer self-verifies its work against the same lines before opening its PR.
