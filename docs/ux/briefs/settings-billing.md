# OD Brief — Settings ▸ Billing / subscription (the operator's OWN HeyHenry subscription)

> **What this screen is — and is NOT.** This is the **tenant's subscription to HeyHenry** — the GC paying *us*: their plan, the card *we* charge, *our* receipts to them, and self-serve cancel/pause. It is **not** the customer-facing invoicing the app does for the GC's own clients (that's `invoices.md` / `invoice-detail.md`), and it is **not** Stripe **Connect** (`/settings/stripe`, where the GC connects a Stripe account to *collect* payments from clients). Three money surfaces, one of which is this one — keep them disambiguated in copy. This brief is the **graduate** the parent `settings.md` flagged ("Billing/subscription — **HEAVY → own render**, owner").
>
> **Grounded in (read these before prompting):**
> - **Route / shell:** `src/app/(dashboard)/settings/billing/page.tsx` (server component; `requireTenant()` + `getBillingOverviewAction()`; renders dates in `tenant.timezone`, not the viewer's). Lives inside the settings two-column shell (`settings/layout.tsx`) — sidebar + pane. Nav entry: `settings-nav-items.ts` group **"Billing & plan"** → single item `Billing` (`/settings/billing`, `CreditCard` icon).
> - **Sibling route (disambiguate, do NOT merge):** `src/app/(dashboard)/settings/stripe/page.tsx` → `stripe-connect-card.tsx` — **Stripe Connect onboarding** so the GC can accept card payments **on their own invoices**. Different direction of money. One cross-link line only.
> - **Operator UI (all under `src/components/features/billing/`):**
>   - `CurrentPlanCard` (inline in `page.tsx`) — plan name + cycle + status pill; renewal / trial-end / cancellation-pending / paused lines; promo-code line.
>   - `payment-method-card.tsx` → `update-card-dialog.tsx` — brand/•••• last4/exp display; **Stripe SetupIntent + `PaymentElement`** in a HeyHenry-styled `Dialog` (card data never touches HeyHenry; PCI stays with Stripe).
>   - `change-plan-card.tsx` — plan `Select` (Starter/Growth/Pro/Scale) + cycle `Select` (Monthly / Yearly −20%) → **Preview change** (proration via `previewPlanChangeAction`) → **Confirm**. Upgrade = prorated charge now; downgrade = credit to next invoice.
>   - `invoices-table.tsx` — receipts `table`: Date · Amount · **GST** · Status · Receipt (hosted-invoice `ExternalLink` + PDF `Download`); cursor "Load more" (12/page).
>   - `cancel-subscription-button.tsx` — **the two-step `AlertDialog`** (PATTERNS §3): step 1 = prorated-refund preview + non-coercive "Pause for 30 days"; step 2 = exit-survey reason radios + optional comment. **No discount upsell — that line is locked.**
>   - `resume-subscription-button.tsx` — un-pause; `trial-banner.tsx` + `past-due-banner.tsx` (app-shell banners that deep-link here); `locked-feature.tsx` (visible-but-locked gate → `/settings/billing?upgrade=<tier>`).
> - **Data / actions:**
>   - `src/server/actions/billing-management.ts` — `getBillingOverviewAction` (plan/cycle/status/cancelAtPeriodEnd/pausedUntil/currentPeriodEnd/trialEndsAt/**promoCode**/defaultCard), `listInvoicesAction`, `createSetupIntentAction` + `setDefaultPaymentMethodAction`, `previewPlanChangeAction` + `changePlanAction` (`proration_behavior: 'create_prorations'`), `pauseSubscriptionAction` (30d `pause_collection: mark_uncollectible`) + `resumeSubscriptionAction`.
>   - `src/server/actions/billing.ts` — `startCheckoutAction`, `previewCancelRefund` (pure math, no mutation), `cancelSubscriptionAction` (`cancel_at_period_end=true` + prorated `refunds.create`; trial = `cancel()` now, $0; writes `refunds_log`; sends `refund-confirmation` email), `resolvePromoEffects` (`FOUNDER` → `skip_trial`).
>   - `src/lib/billing/plans.ts` — `PLAN_CATALOG` (name/tagline/monthly+yearly **CAD cents**/highlights/**`seatBand`**), `getPriceId`/`findPlanForPriceId`, `formatCad`. `src/lib/billing/features.ts` — 4-tier gate (`starter<growth<pro<scale`), `effectivePlan` (past_due/unpaid/canceled → starter), `FEATURE_TIERS`.
>   - `src/lib/billing/stripe-subscription.ts` — `loadSubscriptionExpanded`, `getDefaultCard`, `getPlatformStripe`.
> - **Schema:** `0135_tenant_billing_plan.sql` (`tenants.plan` · `subscription_status ∈ trialing|active|past_due|canceled|unpaid` · `stripe_customer_id` · `stripe_subscription_id` · `trial_ends_at` · `current_period_end` · **`founding_member BOOLEAN` = the grandfathered $199 rate, admin-set, not self-serve**). `0136_refunds_log.sql` (`amount_cents` · `currency` default `cad` · `reason` · **`notes`** ← exit-survey reason+comment · RLS: tenant-members SELECT, **write-only via service role**). `src/lib/db/schema/tenants.ts` mirrors `founding_member`.
> - **Vault foundation:** Positioning `5bfa59be`, Object Model `b4d880be`, Role × Object Matrix `03b1ccf4` (Billing = **owner**), IA/Nav `6529e9ae`, Design System Map `f9bf30bf`. Memory: `[[feedback_heyhenry_intent_led_positioning]]` (flat-rate, intent-led — **not** per-seat), `[[feedback_pricing_grandfather_principle]]` (lock sign-up rate forever), `[[feedback_henry_voice_standard_all_tiers]]`, `[[feedback_no_bucket_terminology]]`, `[[feedback_client_not_homeowner]]`.
> - **Design system:** `PATTERNS.md` (**§3 confirm/destructive — the cancel two-step is the canonical example**; §5 `{ok,error}` action shape; §6 empty states; §7 status badges + `src/lib/ui/status-tokens.ts`; §23 tenant-tz dates), `DESIGN.md`, `globals.css` (**Paper palette is live — design to it; rust is the one accent**).
> - **Siblings:** `settings.md` (the shell + IA this graduates from), `invoices.md` / `invoice-detail.md` (the GC→client AR — the thing this is NOT), `business-health.md` (Stripe Connect / payment sources live there too).
>
> **How to use:** the page is **built and live** — this brief is a **Paper-palette restyle + a handful of corrections**, not a rebuild. Render hi-fi desktop + mobile of the pane, then run `heyhenry-design-critique`. Code follow-through → a Dev card (tag `epic:ux-redesign`), created proactively.
>
> **⚠ Code-wins corrections (current-state truth vs. the parent brief / the canon):**
> 1. **Server gate is owner _and admin_, not owner-only.** `changePlanAction`, `pauseSubscriptionAction`, `cancelSubscriptionAction` all allow `role === 'owner' || role === 'admin'`. The parent `settings.md` + Role × Object Matrix say **owner-only**. The code is the current truth; the canon is the target. **Resolve before nav-role-filtering ships** (Open Q1) — don't silently encode either.
> 2. **`PLAN_CATALOG` still carries `seatBand` strings** ("1–2 seats", "2–10 seats", …). They are **not rendered** in `ChangePlanCard` today (the Select shows name + `$/mo` only) — good — but they're a latent per-seat leak one careless `{copy.seatBand}` away from violating flat-rate positioning. **Do not surface seat bands on this screen** (see §Financial). Flag the field for removal/rename to an intent line.
> 3. **`?upgrade=<tier>` is a dead deep-link.** `locked-feature.tsx` links to `/settings/billing?upgrade=growth`, but `page.tsx` reads **no `searchParams`** — the param does nothing. Target: read it and scroll/pre-select the Change-plan card to that tier (§Subscreen — Change plan).
> 4. **Trial / past-due banners aren't mounted.** `TrialBanner` + `PastDueBanner` exist and deep-link here, but no app-shell file references them yet. They're the *inbound* path to this screen — spec the destination assuming they'll land (§States).

**Object / workflow / role(s):** primary object = the **tenant's HeyHenry subscription** (`tenants.plan` + `subscription_status` + the Stripe `customer`/`subscription`/`invoice`/`refund` mirror); workflow = **account lifecycle** — *trial → active → (change plan | update card | pause) → cancel*, with **grandfathered pricing** as a standing constraint. Roles: **owner** (full; the canonical home); **admin** (full per current code — see correction #1); **member / worker / client = never** (`/settings` is dashboard-only; a member hitting the URL gets a clean "owner only" state, not a crash). **Primary action:** *understand what I'm paying and when it renews — and change plan / card, or wind down, without a phone call or a trip to Stripe.*

## Purpose
The one screen where the GC manages **their relationship with HeyHenry as a vendor**. Four jobs:
1. **Know the state at a glance** — which plan, what cycle, next renewal date + amount, card on file, any promo (e.g. founding rate).
2. **Self-serve the money** — swap plan/cycle (with an honest proration preview), update the card (PCI-safe, in-app), pull receipts with GST for the bookkeeper.
3. **Wind down without friction or coercion** — a fair prorated refund, a genuine pause alternative, a short "why" — **never** a retention discount gauntlet.
4. **Stay grandfathered** — an existing customer's sign-up rate is theirs **forever**; this screen must never imply a forced re-price.

It is **not** AR for the GC's clients, **not** Stripe Connect, **not** a pricing/marketing page (that's `/onboarding/plan` for the no-subscription state).

## Current vs target (the delta this brief drives)
The page is **functionally complete and correct** — native, in-app, tenant-tz dates, real proration, a model-citizen cancel flow. The gaps are **visual + a few honesty/positioning fixes**, not missing capability:
1. **Pre-Paper chrome.** Stock shadcn `Card`s, `Sparkles` icons on every header, no warm cream/rust. Restyle to Paper; **rust is the single accent** — reserve it for the one primary action per card (and the status pill's positive state), nothing else.
2. **Status reads as a generic pill, not a cockpit.** `CurrentPlanCard` shows `status.replace('_',' ')` in a bordered pill. Target: a **state-first headline** (see §Cockpit) wired to `status-tokens` tones, with the renewal/trial/pause/cancel line as the subhead.
3. **Grandfather is invisible.** A founding/grandfathered member (`founding_member` true, or a `promoCode` like `FOUNDER`) sees only a faint "Promo applied: FOUNDER" line. Target: an explicit, **reassuring** "You're on your founding rate — locked for as long as you stay" affordance, and a Change-plan card that doesn't threaten that rate (§Financial, §Henry).
4. **Per-seat leak risk.** `seatBand` exists in the catalog (correction #2). Target: never render it; frame tiers by **intent**, not seats.
5. **Dead `?upgrade=` deep-link + unmounted banners** (corrections #3–4) — close the loop so the LockedFeature CTA and the trial/past-due banners land somewhere that responds.
6. **Stripe-Connect confusion.** Two "Stripe" things in settings. Target: one disambiguating line so the operator never updates the wrong card.

**Target:** the same five cards, restyled to Paper, **state-first**, **grandfather-honest**, **seat-silent**, with the inbound deep-links wired — and the cancel two-step preserved exactly as built (it's already the reference implementation).

## Layout *(compose from `card`, `badge`, `table`, `select`, `dialog`, `alert-dialog`, `button`, `skeleton` — no new primitives)*
Single column, `max-w-3xl`, inside the settings pane. Page header (`h1` "Billing" + sub with a `/refund-policy` link — keep). Then, top → bottom, the operator's reading order (state → money I owe → money I can change → history → exit):

1. **Plan & status cockpit** *(was `CurrentPlanCard`)* — the headline state + the one renewal fact. Restyle, don't rebuild. (§Cockpit.)
2. **Payment method** *(`payment-method-card`)* — `brand •••• last4 · expires MM/YY` + **Update card** → the SetupIntent dialog. One line of trust copy: "Card details go to Stripe — HeyHenry never sees them."
3. **Change plan** *(`change-plan-card`)* — two `Select`s + Preview → Confirm, with the proration result in a `bg-muted/30` panel. **Seat-silent** (correction #2). Honors `?upgrade=` (correction #3).
4. **Invoice history** *(`invoices-table`)* — receipts with the **GST** column; hosted + PDF links; Load-more.
5. **Cancel subscription** *(`cancel-subscription-button`)* — its own card with the policy sentence; the destructive `text-destructive` outline button opens the two-step. (§Subscreen — the heavy one.)

> **No-subscription branch** (`overview.hasSubscription === false`): a single `Sparkles` card → `/onboarding/plan` ("Choose a plan →"). This is the only state that points *out* to the pricing page. Restyle to a proper empty state (§States).

## Progressive disclosure
- **Snapshot:** the cockpit — plan, cycle, status, next renewal date + amount. The one-glance answer to "what am I paying and when."
- **Operational:** the four action cards (card, plan, receipts, cancel) — each self-contained; previews before commits (plan proration, cancel refund) so nothing destructive fires unseen (PATTERNS §3/§5).
- **Detail:** the dialogs/flows — SetupIntent card form, plan-change proration panel, the two-step cancel. Layered, never inline-destructive.
- **Audit:** `invoices-table` is the receipt trail the operator sees; `refunds_log` is the **internal** trail (RLS allows the owner to SELECT their own — a future "refund history" read, not in this render). The tenant's broader change log is `/settings/audit`.

## Henry intelligence touchpoints *(labeled, undoable — never a chat box; per `[[feedback_henry_intelligence_not_chat]]`)*
Billing is a **low-Henry, high-trust** surface — resist the urge to bolt on AI. Two *small, honest* touchpoints only:
1. **Grandfather guard (the one that matters).** When a grandfathered/founding member opens **Change plan**, Henry-labeled inline note: *"You're on your founding rate ($X/mo, locked). Switching tiers moves you to current pricing — we'll show the exact number before anything changes."* Sourced from `founding_member` / `promoCode`; **informational, fully reversible** (they can back out at Preview). This operationalizes `[[feedback_pricing_grandfather_principle]]` at the one moment it's at risk. *(Target — not built.)*
2. **Pre-renewal nudge surfaces _here_, not as chat.** The existing `TrialBanner` ("card will be charged — update plan/payment now") is the Henry-style proactive nudge; this screen is its **landing pad**. No new panel — just make sure the deep-link lands on the relevant card (trial → cockpit/card; past-due → card). *(Wiring, per correction #4.)*

Explicitly **out of scope / banned:** any "would $X off help?" retention offer in the cancel flow (PATTERNS §3 — locked); any seat-upsell prompt; a billing chatbot.

## Role variations
- **Owner:** the full screen. The canonical, matrix-correct home for billing.
- **Admin:** **today, full access** (the server actions permit it — correction #1). If the canon (owner-only) wins, admin gets a read-only cockpit + receipts and the mutating cards collapse to an "ask the owner" note. **Pending Open Q1 — don't bake either silently.**
- **Member:** never. Nav must stop advertising Billing to members (the parent `settings.md` headline fix); the page already gates server-side via the action role checks, but a direct URL hit should render a clean **"Billing is owner-only"** state (icon + line + "Ask your account owner"), not a crash or a blank.
- **Worker / client (portal):** no path here at all — `/settings` is dashboard-only. The portal **never** shows HeyHenry's pricing, the GC's plan, the GC's card, or these receipts (homeowner-boundary: this is *the GC's vendor relationship*, doubly off-limits).

## Mobile vs desktop
Settings is desktop "thinking work," but billing is **rare-touch and must work on a phone** (a card declines on a job site; the bookkeeper texts asking for a receipt). The single-column stack already collapses cleanly:
- **Desktop:** the five-card column in the settings pane (sidebar at left).
- **Mobile:** sidebar → the `<select>` nav; cards full-width; the plan/cycle `Select`s and the cancel `AlertDialog` are already touch-fine. **≥44px** targets on every button and the receipt row's hosted/PDF icon-buttons (they're `size="sm" ghost` today — bump hit-area on mobile). The `PaymentElement` (Stripe iframe) is responsive — verify the dialog isn't clipped under `sm:max-w-md` on a 360px screen.
No offline mode — billing is online-only by nature (Stripe round-trips); a dropped connection shows the error state, not a queue.

## Financial / Canadian
- **CAD throughout**, `Intl.NumberFormat('en-CA', currency)` (already used in every formatter); `formatCad` for catalog prices. Currency comes from Stripe (`'cad'` default).
- **GST on HeyHenry's receipts to the GC.** The invoice table's **GST column** is the load-bearing Canadian primitive here — it's what the GC's bookkeeper needs to claim the input tax credit on their HeyHenry subscription. `extractTaxCents` reads both legacy `tax` and new `total_taxes[]` shapes — keep it; show `—` when zero. Hosted-invoice + PDF links are the actual CRA-acceptable receipts.
- **Flat-rate, intent-led — NEVER per-seat** (`[[feedback_heyhenry_intent_led_positioning]]`). On Change plan, the `Select` shows **plan name + flat $/mo** (Starter $169 · Growth $399 · Pro $699 · Scale $1,299 monthly; yearly −20%). **Do not render `seatBand`.** If tiers need a one-liner, use the **`tagline`** (intent: "Solo operator" / "Small crew" / "Established operation"), which reads as fit, not a seat meter — and even those lean headcount, so prefer pure capability framing in the restyle. No seat counters, no "per user," no "add a user" math anywhere on this screen.
- **Grandfather (`[[feedback_pricing_grandfather_principle]]`).** `founding_member` / active `promoCode` = locked sign-up rate. Surface it as reassurance (cockpit badge + Henry guard on Change plan); the **list price can rise freely** in the catalog without this customer's number moving. The screen must never imply "your rate is going up."
- **Refund math (cancel):** prorated by **unused days / total days** of the current paid period, to the original card; trial = $0, access ends now; past periods never refunded. This is `/refund-policy` made operational — keep the preview exact and the policy link in the header.
- **Interac note:** subscription billing to HeyHenry is **card-only** (Stripe `payment_method_types: ['card']` on the SetupIntent) — Interac e-Transfer parity applies to the GC's *clients paying the GC*, not the GC paying us. So the usual "e-Transfer at parity" Canadian primitive **does not apply on this screen** — don't add an e-Transfer option here.

## States
- **Empty (no subscription):** `overview.hasSubscription === false` → one card, icon + "No active subscription" + "Pick a plan to unlock the full HeyHenry feature set" + **Choose a plan →** (`/onboarding/plan`). Proper Paper empty state (PATTERNS §6).
- **Empty (no invoices yet):** table → "No invoices yet." (trial before first charge).
- **Empty (no card):** payment card → "No card on file." + **Add card** (same SetupIntent dialog).
- **Loading:** the page is an RSC (overview resolves server-side, no skeleton needed for the cockpit); the **client** sections show their own: invoices "Loading…" (→ swap to `skeleton` rows on restyle), card-update dialog "Loading secure card form…", refund preview "Calculating refund…". Keep these.
- **Status states (drive the cockpit pill + headline):**
  - `trialing` → "Trial — N days left," renewal = first-charge date; (banner inbound).
  - `active` → "Active," "Next renewal {date} for {amount}."
  - `cancel_at_period_end` → "Cancellation pending — access until {date}."
  - `paused` (`pause_collection.resumes_at`) → "Paused — resumes {date}" + **Resume now**.
  - `past_due` / `unpaid` → **needs-action** tone, "Payment failed — update card to restore Growth/Pro/Scale features," card card highlighted; this is where `PastDueBanner` lands.
  - `canceled` → "Canceled — access ended; your data is preserved," with a **Reactivate** path back to `/onboarding/plan`.
- **Error:** every action returns `{ ok, error }` → `toast` (already wired); SetupIntent/confirm failures surface Stripe's message inline in the dialog; never lose the user's place.
- **Permission (member direct-hit):** clean "owner-only" card (per §Role variations), not a 500.
- **Offline:** show the error state — no optimistic billing writes.

## Subscreen inventory *(enumerate every surface; light = inline one-liner, heavy = its own row/spec)*
- **Cancel subscription — two-step `AlertDialog` (HEAVY; the reference flow — preserve exactly, restyle only).**
  - *Step 1 — Intro/preview:* trigger = destructive outline "Cancel subscription." Content = `previewCancelRefund()` result: **trial** → "Trial ends immediately, no refund, data kept 30 days"; **paid** → "Refund **$X** (N unused days of $Y) to your original card · access until **{date}**." A `bg-muted/40` panel: **"Just need a break? Pause for 30 days"** (non-coercive, `pauseSubscriptionAction`). Footer: "Never mind" · "Continue cancelling." States: loading ("Calculating refund…"), preview-error, trial-vs-paid branch.
  - *Step 2 — Exit survey:* radios (`too_expensive · missing_features · switching_tools · business_change · temporary_break · too_complex · other`) + optional `Textarea` (≤500). Footer: "Back" · destructive "Cancel subscription." Reason+comment ride along to `cancelSubscriptionAction` → appended to `refunds_log.notes`. **No discount upsell anywhere** (PATTERNS §3 — locked). On success: toast ("$X refund on its way" / "Auto-renewal stopped" / "Trial cancelled"), dialog closes, page revalidates. Confirmation email (`refund-confirmation`) sends server-side.
  - *Restyle scope:* Paper tones, keep the radio semantics (real `role="radiogroup"`), keep the pause panel non-coercive. **Do not add retention offers, "are you sure?" guilt copy, or a third step.**
- **Update payment method — `Dialog` (MEDIUM).** Trigger = "Update card" / "Add card." Content = Stripe `PaymentElement` (tabs layout) on a `SetupIntent` client secret; trust line "card data goes to Stripe." Actions = Cancel · Save card → `setDefaultPaymentMethodAction` (promotes PM to default on customer **and** active subscription). States: loading secret, Stripe confirm error (inline), success toast + `router.refresh()`. Restyle the dialog chrome to Paper; the Stripe iframe keeps its own `appearance: 'stripe'` (acceptable — it's a sandboxed control).
- **Change plan — inline expander, not a modal (MEDIUM).** Two `Select`s → **Preview change** (`previewPlanChangeAction`, proration: charge-now / credit-next / no-change + next renewal date+amount) → **Confirm** (`changePlanAction`) or **Back**. Add: honor **`?upgrade=<tier>`** to pre-select + scroll (correction #3); add the **grandfather Henry guard** for founding members (§Henry). **Seat-silent.** Webhook flips local plan after Stripe acks; copy already says "updates after we hear back from Stripe" in spirit — keep that honesty.
- **Resume subscription — inline button (LIGHT).** Shown only when paused, inside the cockpit's paused line. `resumeSubscriptionAction` → toast + refresh. Trigger · one action · pending state.
- **Invoice receipt links — external (LIGHT).** Per row: hosted-invoice (`ExternalLink`, new tab) + PDF (`Download`, new tab) — both Stripe-hosted; `aria-label`ed. Load-more paginates (cursor). Not a sub-route — external Stripe pages.
- **No-subscription → `/onboarding/plan` (LIGHT, out-link).** The only path off this screen to pricing; already its own onboarding flow — don't re-spec here.
- **Permission state (LIGHT).** Member direct-hit → owner-only card (§Role variations).
- **Stripe Connect (`/settings/stripe`) — separate route, NOT a subscreen of this screen.** Listed only to disambiguate: it's the GC collecting from *their* clients; one cross-link line max. Lives in `business-health.md` / `settings.md` scope.

## Accessibility
WCAG 2.2 AA. Status is **never colour-alone** — the cockpit pill pairs `status-tokens` tone with text + `statusToneIcon` glyph (CVD-safe), matching every other badge in the app. The cancel exit-survey is a real `role="radiogroup"` with `<label htmlFor>` per radio and a labeled `Textarea` (already correct — preserve through restyle). Dialogs (`alert-dialog`, `dialog`) trap focus and restore it to the trigger on close (shadcn default — don't break it). The Stripe `PaymentElement` manages its own field labels/contrast inside its iframe; the surrounding dialog must keep a visible title + description. All buttons + the receipt icon-buttons hit **≥44px** on touch (bump the `size="sm" ghost` receipt links on mobile). Money + dates have text content (not icons) for screen readers; dates render in tenant tz so the spoken value matches the visible one. Focus order = visual top-to-bottom (cockpit → card → plan → receipts → cancel). The `/refund-policy` link is real text, underlined, in the header.

## Open questions *(assumptions + current-vs-target deltas this screen surfaces)*
1. **Owner-only vs owner+admin (the headline correction).** Code = owner **or** admin can change plan / pause / cancel; canon (Role × Object Matrix + `settings.md`) = **owner only**. Resolve before nav-role-filtering ships. **Ops/product confirm** — then align the action guards *and* the nav together; don't encode either silently. *(Assumption pending answer: brief specs the matrix-correct owner-only target, with admin read-only fallback, but flags that today's code is broader.)*
2. **`seatBand` removal.** Confirm we delete/rename `PLAN_CATALOG.seatBand` to an intent line (or drop it) so it can't leak. It's unrendered today but it's a loaded gun against flat-rate positioning. **Coding (small) + a copy call** on per-tier intent strings.
3. **Grandfather signal source.** Surface "founding rate locked" from `founding_member` (DB flag) and/or active `promoCode` (`FOUNDER`)? They can disagree (a promo without the flag, or vice versa). Pick the canonical source for the cockpit badge + the Change-plan Henry guard. **Product confirm.**
4. **Wire `?upgrade=` + mount the banners.** Close corrections #3–4: `page.tsx` reads `searchParams.upgrade` and pre-selects the Change-plan tier; `TrialBanner`/`PastDueBanner` mount in the dashboard shell and deep-link here. **Coding** (small) — proactively → a Dev card.
5. **Refund-history read for the owner.** `refunds_log` RLS already lets the owner SELECT their own rows, but nothing renders them. Worth a small "Refunds" section under invoices, or defer? **Defer unless asked** — receipts cover the common need.
