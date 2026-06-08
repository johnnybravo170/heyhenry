# OD Brief — Onboarding / first-run (account → ready-to-work)

> **Grounded in (read these before prompting):**
> - **The task's named file does not exist.** There is **no `src/app/(auth)/onboarding/page.tsx`**. The only thing under `onboarding/` is the plan picker: `src/app/(auth)/onboarding/plan/page.tsx` (+ `plan/success/{page,poller,actions}.tsx`). **There is no post-signup "set up your business" step at all.** This brief specifies one as the headline target delta — see *Current vs target*.
> - **Auth shell:** `src/app/(auth)/layout.tsx` — centered, `bg-muted/30`, `<HeyHenryWordmark>` above a `max-w-sm` card, footer "Built for contractors. Made in Canada." Wraps login / signup / magic-link / check-email / callback / `/onboarding/plan`. (`src/components/branding/heyhenry-wordmark.tsx`: ink "H" badge + "HeyHenry".)
> - **Signup (the real provisioning path):** `src/app/(auth)/signup/page.tsx` — single `<Card>` form: first/last name, **business name**, email, **mobile phone** (`+1 604 555 1234`), password (8+, 1 letter + 1 number), ToS/Privacy `<Checkbox>` (submit disabled until checked). Title "Get started with HeyHenry" / "Run your jobs from the truck. We handle the paperwork." On success → `router.push('/dashboard')`.
> - **Server action:** `src/server/actions/auth.ts` `signupAction` → `admin.auth.admin.createUser({ email_confirm: true })` (no email gate) → `signup_tenant` RPC (one Postgres txn: tenant + owner `tenant_members` + `referral_codes` + `seed_default_expense_categories` + `seed_default_payment_sources`; rolls back + deletes auth user on failure) → sign in → `sendWelcomeEmail` → **redirect**: `/onboarding/plan?...` *only* if `?plan&billing` present, else `/dashboard`. **`p_vertical` is hardcoded `'renovation'`** (`auth.ts:143`). Migrations: `20260513165500_atomic_mutation_rpcs.sql`, `20260514041621_add_name_to_signup_tenant.sql`.
> - **Plan picker:** `src/components/features/onboarding/plan-picker.tsx` — **Growth-only** (`PLAN_ORDER = ['growth']`; Starter/Pro/Scale exist in catalog but are direct-sales). Monthly/Yearly toggle ("20% off"), one `PlanCard`, "14-day free trial. Card required." (or "Card charged today." when `skipTrial`). FOUNDER promo copy → "Growth $199/mo CAD (regular $399)." `src/lib/billing/plans.ts` (`PLAN_CATALOG`, `formatCad`). `plan/success/poller.tsx` auto-polls `stripe_subscription_id` every 1s ≤30s then falls back.
> - **Business-profile fields all exist — but only in Settings, filled later:** `src/app/(dashboard)/settings/profile/page.tsx` → `business-profile-form.tsx` (name, phone, contact email, address1/2, city, **province `<select>`** from `PROVINCE_OPTIONS`, postal, website, review URL, **GST number** "123456789 RT0001", **WCB account** "WCB-XXXXXXX") + `logo-uploader.tsx` (file input, image preview, "PNG, JPEG, WebP, or SVG. Up to 5 MB."). Schema: `tenants.gst_number` / `wcb_number` (`0079_gst_wcb_numbers.sql`), `logo_storage_path` + address + `socials` jsonb (`0044_business_profile.sql`). Action: `src/server/actions/profile.ts` (`updateBusinessProfileAction`, `uploadLogoAction`, `clearLogoAction`).
> - **First impression today = the dashboard, not an onboarding screen:** `src/components/features/dashboard/first-run-hero.tsx` (3 vertical-aware step cards — *Add a customer · Start a project · Build a quote* for reno; *…· Build a quote · Send it* for service verticals) shown when `isFirstRunTenant` (`src/lib/db/queries/first-run.ts`: zero customers + projects + quotes). Plus Jonathan's welcome email (`src/lib/email/welcome.ts`, idempotent on `welcome_email_sent_at`, reply-to `hello@inbound.heyhenry.io`).
> - **Phone verification is now lazy (zero-friction):** `src/server/actions/onboarding-verification.ts` (`sendPhoneVerificationAction` / `verifyPhoneAction`, 6-digit SMS, 10-min TTL) fires the *first time the tenant sends an SMS feature* — **not** during onboarding. **`/onboarding/verify` has been deleted** (audit #10).
> - **Adjacent (do NOT fold into owner onboarding):** `src/app/(auth)/join/[code]/page.tsx` — worker / bookkeeper / member invite (its own brief space; role-routes to `/w`, `/bk`, `/dashboard`). `login` / `magic-link` / `check-email` / `callback` are the auth *entry*, not first-run.
> - **The audit is the spine of this brief:** `docs/onboarding-audit-2026-05.md` (every funnel touchpoint, current-vs-gap, after Mike's signup). Companion to ops research card `b9b163ee`.
> - **Design system (live):** `DESIGN.md` (warm paper, **single rust accent `#C2410C` / soft `#FEF0E3`, one accent per screen**; primary buttons + focus rings stay **ink `#0a0a0a`**), `PATTERNS.md` (§3 confirm, §5 `{ok,error}` action shape, §6 empty states, §7 status badges, §18 mobile targets, §23 tenant-tz dates), `src/app/globals.css` (`--background #f3ebdb`, `--card #fff`, `--brand #c2410c`), `src/lib/ui/status-tokens.ts`. Foundation: Positioning `5bfa59be`, IA/Nav `6529e9ae`, Object Model `b4d880be`.
> - **How to use:** paste into the OD project (deepened Paper palette + DESIGN.md typographic discipline), generate **mobile-first** then desktop, run `heyhenry-design-critique`.

**Object:** the tenant being born (account + business + first value) · **Roles:** the **owner** signing up (workers/bookkeepers come in via `/join/[code]` — out of scope) · **Primary action:** get from first-click to a *real first action* (a quote sent / customer added) with the least friction, while quietly capturing trust signals (logo, GST/WCB) along the way

---

## Purpose
The tenant's first ten minutes. This is the **first impression after the marketing site** (the audit's strongest funnel stage), and the moment we either earn "this was built for me" or read like a YC-template form. Two jobs, in tension, and the order matters:

1. **Time-to-value** — the fastest honest path to the contractor *doing the thing they came to do* (their first quote / first customer). Friction here is the enemy; this is why verification gates were ripped out.
2. **Trust + correctness** — capture the few things that make HeyHenry's output look legitimate on day one (business name, **logo**, **GST/WCB on the estimate footer**, province for tax) — **without** turning onboarding into a settings wizard before the contractor has seen a single screen.

The resolution: **don't gate value on profile completeness.** Signup creates the tenant and drops them into the app; a *light, skippable, resumable* business-profile pass and the first-run quickstart do the trust work in parallel — Henry nudging, never blocking.

---

## Current vs target (the delta this brief drives)
- **Current:** `/signup` (one dense form) → `signupAction` (vertical hardcoded `renovation`, tenant provisioned) → **straight to `/dashboard`**, where `FirstRunHero` and a welcome email do all the first-run work. The plan picker is reachable only via a marketing `?plan&billing` deep-link. **Business profile (logo, GST, WCB, address, province) is never surfaced during onboarding — it sits in Settings ▸ Profile and most people never find it,** so day-1 estimates/invoices ship with no logo and no GST/WCB footer. There is no vertical choice. There is no "meet Henry" moment.
- **Target (what this brief specifies):**
  1. A **first-run setup pass** — a lightweight, **skippable, resumable** sequence the owner lands in after signup: **(a)** confirm/choose **vertical**, **(b)** a one-screen **business profile** (logo + GST/WCB + province + address), **(c)** a one-line **"meet Henry"** orientation, then **(d)** hand off into the existing quickstart. Every step is *skip-for-now*; nothing blocks the dashboard.
  2. **Profile capture moves earlier** (out of buried Settings into the first-run pass) — same fields, same `updateBusinessProfileAction` / `uploadLogoAction`, same components, just surfaced at the right moment with payoff framing ("this is what your customers see on the estimate").
  3. **Vertical becomes a choice** instead of a hardcode — needed because nav is DB-driven per vertical and copy/first-run steps differ (reno vs pressure-washing).
  4. The whole thing reuses what exists — `business-profile-form.tsx`, `logo-uploader.tsx`, `plan-picker.tsx`, `first-run-hero.tsx`. **This is a sequencing + framing change, not new machinery.** Net-new code is thin: a resumable step shell + an `onboarding_step`/`onboarding_completed_at` marker on `tenants`.
- **Open product call (flag, don't silently decide):** does the profile pass live as a **standalone `/onboarding` route** (a 3–4 step flow inside the `(auth)` shell) or as a **first-run banner/checklist on the dashboard** that expands the existing FirstRunHero? This brief specs the route as primary and the dashboard checklist as the lighter fallback — see *Open questions*.

---

## The flow (state machine the screen serves)
```
marketing CTA ──▶ /signup ──(signupAction: tenant provisioned, signed in)──┐
                                                                            │
   ?plan&billing present? ──yes──▶ /onboarding/plan ──▶ Stripe ──▶ /plan/success ──┐
                                                                            │       │
                                  no ────────────────────────────────────▶ │ ◀─────┘
                                                                            ▼
                                              /onboarding  (NEW — first-run setup pass)
                                              step 1 Vertical  → step 2 Business profile
                                              → step 3 Meet Henry → step 4 First action
                                              (every step: Skip · Back · resume on return)
                                                                            ▼
                                                       /dashboard (FirstRunHero until first
                                                        customer/project/quote exists)
```
- **Resume:** an owner who bails mid-setup and returns lands back on their **furthest-incomplete step** (read `tenants.onboarding_step`), never re-asked for what they already gave. Once `onboarding_completed_at` is set (or they hit "I'll do this later" on the final step), `/onboarding` redirects to `/dashboard`.
- **Trial state** rides along untouched: `trial_ends_at`, `subscription_status`. The setup pass is independent of billing — a no-card trial tenant still does it.

---

## Layout (regions → real primitives)
Inside the **`(auth)` shell** (wordmark + footer): a single centered `<Card>` (lift the `max-w-sm` to `~max-w-md` for the profile step), one step at a time. Top of card: a quiet **progress affordance** — "Step 2 of 3" + a thin segmented bar (ink fill on paper track; **not** rust — rust is reserved for the one CTA). Bottom: primary `<Button>` (ink) + a low-emphasis **"Skip for now"** link (`text-muted-foreground`, `text-sm`).

1. **Account** — `src/app/(auth)/signup/page.tsx`, essentially as-is (the audit's copy-rewrite gap, #4, applies: warm contractor framing, payoff line). The plan-context chip (`?plan=`) and referral chip stay. **Keep it one screen** — name + business + phone + email + password + ToS. This is the only hard-required step.
2. **Plan** *(conditional)* — `plan-picker.tsx`, Growth-only, 14-day trial, FOUNDER → $199 grandfather. Only shown on the paid-CTA path; the default trial path skips it. (See *Financial / Canadian* for the flat-rate guardrails.)
3. **Vertical (NEW, step 1 of setup)** — "What kind of work do you do?" Two-or-three large tappable `<Card role="button">` tiles (pattern lifted from `plan-picker`'s `PlanCard` keyboard-accessible card): **General contracting / renovation** (default, pre-selected) and **Pressure washing** (+ room for more as the enum grows: `renovation`, `tile`, `pressure_washing`). Writes `tenants.vertical`; **re-runs the vertical-specific seeds** if it differs from the signup default. Drives DB nav + the FirstRunHero variant + Henry's system prompt vertical. One tap → continue.
4. **Business profile (NEW, step 2 of setup)** — the trust step, reusing `logo-uploader.tsx` + a **trimmed** `business-profile-form.tsx`. **Only the day-1-visible fields**, each with payoff microcopy:
   - **Logo** (`logo-uploader.tsx` as-is) — "Goes on every estimate and invoice your clients see."
   - **GST number** + **WCB account** — "Shown in the footer of estimates and invoices." (Optional — many sole-props aren't GST-registered yet; never required.)
   - **Province** (`PROVINCE_OPTIONS` `<select>`) — "Sets the right sales tax (GST/PST/HST)." This one earns its place because tax correctness depends on it.
   - **Defer** address line 1/2, city, postal, website, review URL, socials → they stay in Settings ▸ Profile (not day-1-critical; don't pad the step). The full form remains the canonical editor.
5. **Meet Henry (NEW, step 3 of setup)** — a single calm card, **not a chat box**: a ✦-marked line in Henry's voice — *"I'm Henry. I'll draft your quotes, chase late invoices, and keep the paperwork straight so you can stay on the tools."* + 3 one-line "here's what I'll do" bullets tied to real embedded features (draft from a photo/voice note, follow up on a sent estimate, flag an overdue invoice). One **"Let's go"** CTA. No input field, no bubble — this orients, it doesn't converse. (Per `[[henry-intelligence-not-chat]]`.)
6. **First action / hand-off** — drop into `/dashboard` where `FirstRunHero` (already vertical-aware) presents the 3 quickstart cards. The setup pass's final CTA *is* the bridge — ideally deep-link straight to step 1 of the hero ("Add your first client →" / `/contacts/new`) so momentum carries.

---

## Progressive disclosure
- **Snapshot:** one step per screen — never a 20-field wall. Account is the only required gate; everything after is skippable.
- **Operational:** the profile step shows only day-1-visible fields; the rest live one level down in Settings ▸ Profile (linked as "More business details" for the eager).
- **Detail:** plan comparison / other tiers are *not* surfaced (direct-sales); "Compare plans" can link out rather than expanding the picker.
- **Audit:** none in onboarding — `welcome_email_sent_at`, `onboarding_completed_at`, ToS/privacy version + accepted-at are recorded server-side, not shown.

---

## Henry intelligence touchpoints
*(Embedded + light, never a chatbot — the whole point of this product.)*
- **"Meet Henry" step** — the one explicit Henry surface in onboarding: a labeled ✦ orientation line + capability bullets. Accent reflects tone (warm/positive, **never rust-as-alarm**). Sets the expectation that Henry is *the intelligence behind features*, then steps out of the way.
- **Logo extraction (target, opportunistic):** if the contractor uploads a logo, Henry can offer to **pull brand colors / business name** from it to prefill — labeled + undoable. (Nice-to-have; flag as future.)
- **Province → tax inference:** picking a province lets Henry preset the correct GST/PST/HST default on the first estimate — surfaced later *in* the estimate, not as onboarding noise.
- **Welcome email** (`welcome.ts`) is the off-screen Henry/Jonathan touch that fills the post-signup silence — keep it; it's the audit's #1 fixed gap.
- **No standing Henry panel, no chat bubble** during onboarding. Henry shows up as one orientation card and as prefill offers, nothing more.

---

## Connections (what onboarding wires to)
- **→ Settings ▸ Profile** — same fields, same actions; onboarding is an earlier, lighter front door to `business-profile-form.tsx` / `logo-uploader.tsx`. The two must stay in sync (one writer: `updateBusinessProfileAction`).
- **→ Dashboard / FirstRunHero** — the hand-off target; the hero stays until `isFirstRunTenant` flips false.
- **→ Billing** — `/onboarding/plan` → Stripe Checkout → `/plan/success` poller → `subscription_status`; the trial path bypasses it entirely.
- **→ DB-driven nav** — the vertical chosen in step 1 selects the nav set + FirstRunHero variant + Henry's vertical prompt (`system-prompt.ts`).
- **→ Estimates / Invoices** — GST/WCB/logo/province captured here are exactly what render in the estimate & invoice footer/letterhead (the *why* behind the trust step).
- **→ `/join/[code]`** — the *other* onboarding (workers/bookkeepers). Owner onboarding must not assume a solo tenant forever, but does not handle invites — separate surface.

---

## Role variations
- **Owner** (the only role here): the full account → setup → first-action pass. `signup_tenant` always stamps the first member as `owner`.
- **Worker / bookkeeper / member:** **N/A** — they arrive via `/join/[code]` (its own card-based flow, role-routes to `/w` / `/bk` / `/dashboard`); they never see the business-profile or plan steps.
- **Client (homeowner):** **N/A** — clients live in the public portal; they never onboard into the app. (Say **"client," not "homeowner"** in any copy that references them.)

---

## Mobile vs desktop
**Mobile-first — contractors sign up on a phone, often from a truck.** This is the governing constraint, not an afterthought.
- **Mobile:** every step is a single full-width card, one primary action per screen, **≥44px** targets (PATTERNS.md §18). Native inputs (`type="tel"` / `type="email"` / numeric keypads). Logo upload uses the OS file/camera picker (`logo-uploader.tsx` already does `<input type="file">` — confirm `capture` isn't forced so the gallery is available). The vertical tiles stack vertically and are thumb-sized. Progress bar pinned near the top so the end feels reachable.
- **Desktop:** same single-column card, centered in the `(auth)` shell — *don't* expand into a multi-column wizard. The plan picker is the one wider surface (`max-w-md` card within `max-w-5xl`).
- **Offline:** not a field surface — onboarding requires connectivity (auth + Stripe). No offline mode; show a clear "you're offline" state rather than a dead submit.

---

## Financial / Canadian
- **GST/WCB** captured in the profile step (`tenants.gst_number` / `wcb_number`) — optional, for the estimate/invoice footer. **Province** (`PROVINCE_OPTIONS`) drives GST/PST/HST defaults. Both reuse existing fields/validation.
- **Plan picker is flat-rate — HARD GUARDRAIL.** **Never show a per-seat or per-user price, and never a seat-count stepper/counter.** `PLAN_CATALOG.growth.seatBand` ("2–10 seats") is **descriptive band text, not a multiplier** — keep it as a footnote, lead with the buyer-intent line, never let it read as "× users." Pricing is one flat monthly/yearly number (`$399/mo CAD`, `formatCad`).
- **Grandfather principle:** the FOUNDER promo locks **Growth at $199/mo CAD (regular $399)** — copy already in `plan-picker.tsx`; honor it (locked at sign-up rate; list price can rise without churning the base). Don't invent other promo copy.
- **CAD** throughout, **tabular-nums**, de-emphasized cents on the plan price. 14-day trial framing ("Card required. Change or cancel anytime." / "Card charged today." when `skipTrial`) stays verbatim from the picker.
- **Trial, no card** is the default path (no plan step) — preserve the audit's "zero-friction" intent; only the marketing paid-CTA path routes through Stripe.

---

## States
- **Empty / first run:** *is* the screen — there's no populated variant. The dashboard hand-off target shows `FirstRunHero` (icon + headline + line + 3 step CTAs) until the first customer/project/quote.
- **Loading:** per-step transitions use the existing `useTransition` pending pattern — buttons go to "Setting things up…" / "Saving…" / "Redirecting…" (verbatim from signup/picker/poller). Skeleton the plan card + the resumed-profile card on load.
- **Error (per step):**
  - **Account:** zod field errors inline; **"already registered" → friendly recovery** with email pre-filled (`/login?email=…`) — the exact dead-end that bit Mike (audit #5), already implemented in `signup/page.tsx`; preserve it. Rate-limit messages ("Too many signup attempts. Try again in …") surface as-is. Phone-parse error → inline hint with the `+1` example.
  - **Profile:** `updateBusinessProfileAction` / `uploadLogoAction` return `{ ok, error }` → `toast.error` (existing). Logo too-large / wrong-type → the uploader's inline guidance ("PNG, JPEG, WebP, or SVG. Up to 5 MB."). A failed save **must not block** advancing — it's all skippable.
  - **Plan:** `startCheckoutAction` error → `toast.error`; Stripe cancel returns to the picker (`?canceled`). `/plan/success` webhook-late → the 30s poller fallback ("still working — we'll email you"), not a manual refresh.
- **Resume-partial:** returning mid-setup → land on furthest-incomplete step (`tenants.onboarding_step`), prior answers intact, never re-asked. Completed (`onboarding_completed_at` set, or "I'll do this later") → `/onboarding` redirects to `/dashboard`.
- **Offline:** clear "you're offline, we can't finish setup" state on submit failure (see Mobile).

---

## Subscreen inventory
*(Each surface the flow spawns. Light ones spec'd inline; heavy ones graduated.)*
- **`/signup` (account step)** — *graduated, exists.* Route + form; the copy-rewrite + logo-on-page polish is audit card #4. Trigger: marketing CTA / "Create my account" · States: idle / pending / field-error / already-registered-recovery / rate-limited.
- **`/onboarding` step 1 — Vertical (NEW)** — inline here. Trigger: post-signup redirect · Content: 2–3 keyboard-accessible card tiles (reno default) · Actions: select → Continue · Skip → keeps `renovation` default · States: default-selected / pending (re-seed if changed).
- **`/onboarding` step 2 — Business profile (NEW)** — the heaviest NEW surface; spec'd inline above but **graduate to its own pipeline row** if it grows past logo + GST/WCB + province. Trigger: step 1 continue · Content: `logo-uploader` + trimmed `business-profile-form` (3 fields) · Actions: Save & continue / Skip for now / "More business details →" (Settings) · States: empty / saving / per-field error / skip.
  - **Logo upload (sub-surface of step 2)** — inline. `logo-uploader.tsx`: file picker → optimistic preview → `uploadLogoAction`; Replace / Remove (`clearLogoAction`). States: empty (ImageIcon) / preview / uploading / type-or-size error / remove-confirm (toast). **Reuse as-is** — do not fork.
- **`/onboarding` step 3 — Meet Henry (NEW)** — inline. Trigger: step 2 continue · Content: one ✦ Henry card + 3 capability bullets · Actions: "Let's go" → dashboard/first-action · States: static only.
- **`/onboarding/plan` (conditional)** — *graduated, exists.* `plan-picker.tsx`. Trigger: `signupAction` redirect when `?plan&billing` · States: monthly/yearly · plan-selected · promo-applied (FOUNDER) · pending/"Redirecting…" · checkout-error toast.
  - **Stripe Checkout** — external surface; HeyHenry-branded via Stripe dashboard (audit #13 — verify logo/colors/`HEYHENRY` descriptor). Not ours to lay out; ensure the hand-off + return are seamless.
  - **`/onboarding/plan/success`** — inline. `poller.tsx`: auto-polls `stripe_subscription_id` 1s ≤30s → `/dashboard`; timeout fallback. States: polling / redirecting / timed-out.
- **Welcome email** — off-screen transactional surface (`welcome.ts`). Not a screen; note it as the post-signup Henry/Jonathan touch (idempotent, reply-to inbound). Authored via the `email-templates` skill if reworded.
- **Auth entry (login / magic-link / check-email / callback)** — *adjacent, exist.* The *return* path, not first-run; in scope only for the shared `(auth)` shell + the `/callback` logo-polish gap (audit #9). Not re-spec'd here.
- **`/join/[code]` (worker/bookkeeper/member invite)** — **graduated to its own brief** — different role, different flow; explicitly *not* owner onboarding.

---

## Accessibility
- **Contrast:** ink `#0a0a0a` on paper `#f3ebdb` / white cards clears AA comfortably; keep `text-muted-foreground` (`#57534b`) for help text only, never for required labels or the progress count. Rust `#C2410C` is decorative-accent + the single CTA — never the *only* signal for a state.
- **Targets:** **≥44px** for every button, vertical tile, plan card, and the logo picker on mobile (PATTERNS.md §18).
- **Focus + keyboard:** the card-as-button tiles must replicate `PlanCard`'s `role="button"` + `tabIndex={0}` + Enter/Space handling. Visible ink focus ring (`--ring` at /50) on every control. Logical tab order top→bottom; the "Skip" link is reachable and clearly labeled ("Skip business profile for now").
- **Semantics:** real `<form>` + `<Label htmlFor>` (existing `Field` wrapper); required marked with `aria` not color alone; errors via `role="alert"` (already in signup/join). Province `<select>` is a native control — keep it. Progress bar gets `aria-valuenow`/`max` or an off-screen "Step 2 of 3."
- **Icons** (✦ Henry mark, step glyphs, status) are `aria-hidden`; meaning carried by text (WCAG 1.4.1) — consistent with `status-tokens.ts` glyph convention.
- **Inputs:** correct `type`/`autoComplete`/`inputMode` so mobile keyboards + password managers behave (signup already does `given-name` / `organization` / `tel` / `email` / `new-password`).

---

## Reject-if self-check (per `heyhenry-design-critique`)
- ✅ One ink, one rust accent — rust only on the single primary CTA; progress bar + selection states are ink/cream, **not** rust.
- ✅ No per-seat / per-user pricing, no seat counter; flat-rate Growth; FOUNDER grandfather honored.
- ✅ Henry is an orientation card + prefill offers, **not** a chat box.
- ✅ "Client," never "homeowner."
- ✅ Vertical-aware (reno default; pressure-washing branch real, not bolted on).
- ✅ Canadian primitives present (GST/WCB/province), CAD, tabular-nums.
- ✅ Mobile-first single-column; no desktop-only multi-column wizard.
- ✅ Every step skippable + resumable; value never gated on profile completeness.
- ✅ Reuses existing primitives/components — net-new is a step shell + a step marker, not new machinery.

---

## Open questions
- **Route vs dashboard-checklist (the big one):** standalone `/onboarding` flow (specced as primary) **vs** a first-run checklist/banner that expands `FirstRunHero` on the dashboard. The route gives a cleaner "set up your business" moment and easy resume; the checklist is lower-friction and keeps people *in* the product. Lean: **route**, but with each step independently skippable so it never feels like a gate — confirm with product. (This is the one piece of net-new surface; everything else is reuse.)
- **Vertical hardcode → choice:** `signupAction` hardcodes `renovation`. Adding a picker means re-running `seed_default_expense_categories(vertical)` if it changes post-signup. Is GC-default-with-a-quiet-toggle enough (given GC is the strategic lane), or do we need the picker up front for the pressure-washing path? (If GC-only for now, step 1 collapses to a confirmation, not a choice.)
- **How much profile is "day-1 critical":** brief says logo + GST/WCB + province; everything else stays in Settings. Confirm WCB belongs at all in onboarding (many reno GCs add it later) vs. logo + province only.
- **Resume marker:** add `tenants.onboarding_step` (int/enum) + `onboarding_completed_at` (timestamptz) — confirm before migrating (timestamp-prefixed per AGENTS.md). Without it, resume falls back to "incomplete profile → show the banner."
- **Logo-derived prefill:** is Henry pulling brand color/name from an uploaded logo worth building for v1, or a later delight? (Flagged as future.)
- **Welcome-email timing vs trial:** welcome fires at signup today (`sendWelcomeEmail` in `signupAction`). For the paid-CTA path, should it instead fire on `checkout.session.completed` so the *paid* moment gets the note (audit #16 framing)? Reconcile so it isn't sent twice.
