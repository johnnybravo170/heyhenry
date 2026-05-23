# OD Brief — Refer & Earn (the operator's referral program)

> **Priority:** **LOW — V1.1 growth candidate.** This surface is fully built and works today; it is not on the GC critical path. Brief now so the pipeline is complete and the repaint lands when growth gets prioritized. Don't graduate the heavy reward-payout work into V1 on the strength of this brief.
>
> **Grounded in (read these before prompting):**
> - **Route / shell:** `src/app/(dashboard)/referrals/page.tsx` (RSC; parallel loads `getReferralLinkAction · getReferralStatsAction · getReferralHistoryAction · getAffiliateTierAction`) → renders `AffiliateOfferCard · ReferralLinkCard · SendReferralForm · ReferralStats · ReferralHistory`, top to bottom. `referrals/loading.tsx` (skeleton). Nav label is **"Refer & Earn"**, icon `Gift` (seeded per vertical pack; mig `0196` restored it on `personal`).
> - **Operator UI:** `src/components/features/referrals/` — `referral-link-card.tsx` (copy + Web-Share), `send-referral-form.tsx` (email **and** SMS invite, E.164 normalize), `referral-stats.tsx` (4 stat cards), `referral-history.tsx` (table + status badge), `affiliate-offer-card.tsx` (tier-gated offer copy).
> - **Public landing:** `src/app/(public)/r/[code]/page.tsx` (`force-dynamic`, `findReferralCodeByCode` via **admin client**, dynamic `<title>`/OG from `tenant_name`) → CTA to `/signup?ref={code}`. Inherits the **brand-light** `(public)/layout.tsx` (white field, "Powered by HeyHenry" footer, no auth/nav/sidebar).
> - **Signup consumption:** `src/app/(auth)/signup/page.tsx` reads `?ref=` (`params.get('ref')`), shows "your trial gets bumped to 14 days," passes `referralCode` into `src/server/actions/auth.ts` → RPC `p_referred_by_code` + `updateReferralOnSignup(code, newTenantId)` flips the newest pending row to **`signed_up`**.
> - **Data / actions:** `src/server/actions/referrals.ts` (`AffiliateTier = tier_1|tier_2|tier_3`; `PUBLIC_DOMAIN` → `app.heyhenry.io/r/{code}`), `src/lib/db/queries/referrals.ts` (`getOrCreateReferralCode`, `getReferralStats`, `listReferrals`, `createReferral` [admin insert], `findReferralCodeByCode` [admin], `updateReferralOnSignup` [admin]), `src/lib/referral/code-generator.ts` (slug-from-name, hyphen-collapse, ≤20 chars, random-8 fallback), `src/lib/validators/referral.ts` (`referralEmailSchema`, `referralSMSSchema` E.164), `src/lib/email/templates/referral-invite.ts` (HTML + subject + SMS body). Migrations: `0024_referral_codes` (`code` UNIQUE, `type ∈ operator|affiliate`, `is_active`; **anon RLS SELECT on active codes** for the landing), `0025_referrals` (`status ∈ pending|signed_up|converted|churned`, `reward_status ∈ pending|earned|applied|expired`, `signed_up_at`, `converted_at`; **RLS: SELECT-only for authenticated, scoped to `referrer_tenant_id`**), `0026_tenants_referral_columns` (`referred_by_code`, `trial_ends_at`), `0197_referrals_phone` (`referred_phone` E.164, mutually exclusive with email), `0196_add_referrals_to_personal_nav`.
> - **Design system:** `PATTERNS.md` (§3 confirm dialogs, §5 `{ ok, error }` action shape, §6 empty states, §7 status badges → `status-tokens.ts`, §9 tabs/mobile-select, §16 Henry import, §18 mobile card rules, §23 tenant-tz dates), `DESIGN.md` (clarity discipline — "color is reserved for action," one ink + one accent, ≤3 type sizes), `src/app/globals.css` (the warm **"Paper"** palette is **live**), `src/lib/ui/status-tokens.ts`. Foundation: Positioning `5bfa59be`, Object Model `b4d880be`, Role × Object Matrix `03b1ccf4`, IA/Nav `6529e9ae`.
> - **Siblings:** **`public-pages.md`** (which explicitly **defers `/r/[code]` to this brief** — "growth surface; spec with intake/lead-gen, not the client-project family"). The public landing is owned **here**; `public-pages.md` cross-references it. `contacts.md` (where a referred contact who signs up *isn't* — referrals invite contractors, not clients). `settings-billing.md` (where an earned reward would credit, if/when built).
>
> **How to use:** paste into OD (HeyHenry "Paper" palette + DESIGN.md clarity discipline), generate hi-fi desktop + mobile for the **operator page** and a separate pass for the **public landing**, then run `heyhenry-design-critique`. Feeds Dev cards on the Ops `dev` board, tag `epic:ux-redesign` (V1.1).

**Object / workflow / role(s):** primary = the **Referral** (`referrals` row: a sent invite + its lifecycle + reward) and its **Referral code** (`referral_codes`, one `operator` code per tenant); workflow = **word-of-mouth growth** — *a contractor recommends a tool they actually use to a peer, and gets a thank-you when that peer becomes a paying customer*. Roles: **owner / admin** (operator page); **a prospective contractor** (public landing — not a client, not a logged-in user). **Primary action:** *share my link / send an invite to a fellow contractor — in two taps, from the phone.*

## Purpose
The operator's referral program — "Refer & Earn." One calm page where a contractor can **grab their referral link, fire off an invite by email or SMS, and see who's signed up**. The tone is a **contractor recommending a tool they like to a buddy on a job site** — never an aggressive affiliate/MLM dashboard. No leaderboards, no countdown timers, no "earn UNLIMITED $$$" energy, no pressure to grind referrals. The reward exists and is stated plainly ($300 when a referred business sticks); it's a thank-you, not the pitch.

It is **not** a client-acquisition surface (clients never see this; referrals invite **contractors**, and a referred signup becomes a *tenant*, not a row in `contacts`). It is **not** the customer portal. It is a quiet, optional growth lever that sits in the personal/account nav.

## Current vs target (the delta this brief drives)
The page is **fully built and functional** — link, copy, Web-Share, email **and** SMS invites, stats, history, tier-gated offer copy, a working public landing, and a wired `pending → signed_up` flip at signup. This brief is therefore **a repaint + a calm-down + honest-state truth**, not a from-scratch build. Six gaps:

1. **Off-palette everywhere.** The offer card paints raw `emerald-200 / emerald-50/50 / emerald-700`; the public landing paints `green-50 / green-700 / green-600` and a hard-coded `#0a0a0a` button; the history badges use **raw shadcn variants** (`outline / secondary / default / destructive`) and **bypass `status-tokens.ts` entirely**. None of this is the Paper palette, and **green-as-reward fights the rule that "color is reserved for action"** (the one accent is rust). Target: Paper field, **rust as the sole accent**, referral states through `status-tokens` (see §States vocabulary). *(Headline change.)*
2. **The reward state is vaporware — but the UI implies it's real.** `getReferralStatsAction` hard-codes **`rewards: 0`** with `// Placeholder until reward system is built`; **nothing in the codebase ever flips a referral to `converted` or advances `reward_status` past `pending`**. So the "Rewards Earned" stat card and the `converted` history badge can light up only in theory. Target: either (a) **honestly label reward/conversion as "coming"** until the payout pipeline exists, or (b) build the conversion+reward flip (heavy — graduates to its own row; see Subscreen inventory). **Do not design a triumphant "$300 earned!" state as if it ships in V1.** *(The single most important honesty flag in this brief.)*
3. **The page is a flat stack of five cards** with no cockpit / next-action. A contractor opening this should immediately see **the one thing to do: share**. Target: lead with the share affordance (link + invite as the hero), demote stats/history to a quiet read below.
4. **`ReferralHistory` re-implements date formatting** with a bare `new Intl.DateTimeFormat('en-US', { timeZone: tz })` locale — works (tz is passed) but should route through `formatDate(iso, { timezone })` per **AGENTS.md §Timezones / PATTERNS §23**. Minor, flag on touch.
5. **The public landing is a hand-rolled one-off** (no `loading.tsx`, no `not-found`, raw greens, `#0a0a0a` button) and its **invalid-code fallback is anonymous** — it silently drops to a generic "Run your contracting business smarter" with no acknowledgement the link was bad. Target: Paper-repaint, a light HeyHenry brand mark, and a graceful invalid/expired-code state.
6. **Henry is entirely absent.** Zero embedded intelligence — no drafted invite message, no "who to refer" nudge, no reward explainer. Low-stakes surface, but a labeled, undoable Henry touch (draft the personal note) fits (see Henry).

**Target:** a calm, share-first **Refer & Earn** page on the Paper palette with rust as the only accent, referral states through `status-tokens`, **honest reward/conversion states** (no fake "earned" celebration until the payout pipeline is real), Henry drafting the invite note, and a brand-light, trustworthy public landing that handles bad codes gracefully. Flagged inline where target ≠ current.

## The data truth this screen must reflect
- **One operator code per tenant** (`referral_codes`, `type='operator'`, `is_active`). `getOrCreateReferralCode` lazily mints it from the business name (`generateReferralCode`: slug, hyphen-collapse, ≤20 chars; collides → `-{rand4}`; empty name → random-8). `affiliate` type exists in the enum but is **unused** — don't surface it.
- **The link is `app.heyhenry.io/r/{code}`** (the app domain hosts the landing; the marketing site does **not**). Don't imply heyhenry.io.
- **Referral lifecycle** (`referrals.status`): **`pending` → `signed_up` → `converted` → (`churned`)**. Only **`pending → signed_up` is wired** (`updateReferralOnSignup` at signup, newest-pending-first). **`converted` and `churned` are never set by any code path.** `reward_status` (`pending → earned → applied → expired`) is **never advanced**. Treat conversion + reward as **target/aspirational** — the schema is ready; the business logic isn't built.
- **A referral carries an email OR a phone** (`referred_email` / `referred_phone`, mutually exclusive in practice; either may be null for a raw link signup). The history row already coalesces to `email ?? phone ?? 'Link signup'`.
- **Stats are derived live** (`getReferralStats`): `total` = all rows; `signed_up` = `signed_up ∪ converted`; `converted` = `converted` only (so always 0 today); `rewards` = **hard 0 placeholder**.
- **Referrals are SELECT-only under RLS** for the operator, scoped to `referrer_tenant_id` — the operator sees only their own. Inserts/updates go through the **admin client** (server actions). The page can never leak another tenant's referrals.
- **The landing reads under anon RLS** — `referral_codes` exposes only active codes; `findReferralCodeByCode` joins `tenants(name)` via admin and returns just `{ id, code, tenant_id, tenant_name }`. **No tenant internals reach the public page** — only the business name.
- **Affiliate tier gates the offer copy** (`tenants.affiliate_tier`, defaults `tier_3`): **tier_3** = public **$300-per-converted-customer, paid after 90 days active, no cap** program; **tier_1 / tier_2** = "custom partner agreement, terms in your signed agreement" (don't render the $300 economics). The action **fails safe to `tier_3`** if the column is missing — and the header subhead already mirrors this (tier_3 → "$300" line, else "covered by your partner agreement").
- **The extended trial IS real** (`0026`): a referred signup gets `trial_ends_at` bumped to 14 days, surfaced on the signup page ("your trial gets bumped to 14 days"). This is the referee's incentive and it works today.

## Layout (operator page — regions → real primitives)
Desktop, top to bottom. Compose existing primitives; **no new chart engine, no new card type.** Reorder for share-first.

**1 · Header.** "Refer & Earn" (`h1`) + a one-line, **calm** subhead. Keep the tier-aware copy that's already there (tier_3 → "Share HeyHenry with other contractors and earn $300 for every one who becomes a paying customer." / else → "...covered by your partner agreement."), but soften toward recommendation, not bounty-chasing.

**2 · Share hero (the cockpit — promote `ReferralLinkCard` + `SendReferralForm` into one calm primary block).** The one job is **share**, so it goes first and reads as the primary action.
- **Your link** (`ReferralLinkCard`): read-only `Input` (mono, the `/r/{code}` URL) + **Copy** (icon button, check-on-success, `sonner` toast — keep) + **Share** (`navigator.share` with copy fallback — keep; this is the mobile money-path). Code shown as a quiet `Code: {code}` caption. **Repaint to Paper** (outline buttons, ink text); **rust reserved** for the single primary affordance only.
- **Send an invite** (`SendReferralForm`): email row + SMS row, each `Input` + a send `Button` (`Mail` / `MessageSquare` icon), `useTransition` pending state, E.164 normalize on the phone (keep `normalizeToE164` — it's a UX nicety; the Zod schema is the authority). Success → toast + clear field (keep). **One visual note:** two stacked forms read as a form-heavy block — consider a single "Invite by email or text" card with a channel toggle, or keep both rows but quiet them under the link (the link is the hero; typed invites are the secondary path).

**3 · Offer card (`AffiliateOfferCard` — keep, repaint, demote).** Tier_3 renders the $300 explainer (flat bounty · paid after 90 days active · no cap) + fine print (operationally-distinct business; clawback on refund/chargeback in the 90-day window). Tier_1/2 renders the partner-agreement note. **Repaint off `emerald-*` onto Paper** — a calm, neutral info card with **at most one soft accent**, not a green "money" card. Keep the fine print (it's load-bearing for the program's integrity) but small and quiet. Position it **below** the share hero — the offer is context, not the headline.

**4 · Stats (`ReferralStats` — keep 4 cards, fix the dishonest ones).** `Referrals Sent` (`total`) · `Signups` (`signed_up`) · `Conversions` (`converted`) · `Rewards Earned` (`rewards`, formatted `$`). **Two of these are always 0 today** (Conversions, Rewards — see data truth). Target: either gate the two unbuilt cards behind a quiet "coming soon" treatment, or drop to **two honest cards** (Sent · Signups) until conversion/reward ships. **Money in CAD** (the `$` is currently bare — make it CAD-aware via `Money`, tabular-nums). Don't render a big bold `$0` reward as if it's a real balance.

**5 · History (`ReferralHistory` — keep table, fix badges + dates).** Table: **Contact** (email / phone / "Link signup", mono) · **Status** (badge) · **Date** (tenant-tz). **Move the status badge onto `status-tokens`** (see §States vocabulary) instead of raw shadcn variants. **Route the date through `formatDate(iso, { timezone })`** (PATTERNS §23). Keep the existing empty state copy intent (see States). Calm — no per-row actions in V1.

## Progressive disclosure
- **Snapshot:** the share hero (link + invite) + the headline number ("3 contractors signed up"). The operating read is "here's my link, here's who's joined."
- **Operational:** copy / share / send-invite; the offer terms.
- **Detail:** the history table (who, what status, when).
- **Audit:** the CASL evidence trail on each invite (`caslEvidence` on the email/SMS send — off-screen, server-side; surfaced only if a compliance view is ever built). Soft signals only; no audit UI in V1.

## Henry intelligence touchpoints (currently **zero embedded**)
Henry is the intelligence behind the feature, **not a chat box** ([[henry-intelligence-not-chat]]). Every output labeled `✦` and undoable. This is a low-stakes surface — keep Henry light and genuinely useful, not gratuitous.
1. **Draft the personal note (the one worth building).** When sending an invite, let Henry draft a short, warm, *peer-to-peer* message in the operator's voice — *"✦ Hey, you should check out HeyHenry — it's what I use to run quotes and invoices. Here's my link."* — fully editable before send, never auto-sent. This keeps the tone "contractor recommending a tool," not canned marketing. (Today the email/SMS bodies are fixed templates with no personalization; the invite has no free-text field at all — adding one + a Henry draft is the upgrade.)
2. **Who to refer (optional, quiet).** Henry could surface a gentle, dismissible nudge — *"✦ You've worked with 3 subs who run their own crews — invite them?"* — sourced from `contacts` (kind = sub/vendor with their own business). **Opt-in, never nagging**; this is the line where a growth feature tips into pushy, so keep it a one-line passive suggestion the operator can dismiss for good, not a recurring prompt. *(Defer past V1.1 unless it tests well — flag.)*
3. **Reward explainer.** If/when the reward pipeline ships, Henry plainly explains state — *"✦ Maple Ridge Renos signed up Mar 3. Your $300 unlocks once they've been active 90 days (≈ Jun 1)."* — turning the opaque `reward_status` enum into a sentence. **Not built until the payout logic is** (don't design the celebratory state prematurely).

## Connections (what Referrals wires to)
- **Signup (`/signup?ref=`)** → the conversion entry point; flips `pending → signed_up` and bumps the referee's trial to 14 days. Already wired.
- **Contacts** → *not* where a referred contractor lands (they become a tenant, not a `customers` row). The only Contacts tie is the **target** "who to refer" nudge (read-only source). Keep these distinct — a referral is a peer business, not a client.
- **Settings ▸ Billing** (`settings-billing.md`) → where an **earned reward would credit** (account credit or payout) — **the missing pipeline.** Flag as the dependency for any real reward state.
- **Email / SMS infra** → `sendEmail` / `sendSms` with **CASL category `response_to_request`** (personal-relationship implied-consent exemption) + `caslEvidence`. The send path is built; Phase B wants a referrer attestation at submit (see Open questions).
- **Public landing (`/r/[code]`)** → the link's destination; owned by this brief (see below). `public-pages.md` cross-references but defers to here.

## The public referral landing (`/r/[code]` — brand-light, trustworthy)
A separate design pass — **this is not operator chrome.** It's a stranger's first impression of HeyHenry, arriving from a peer's recommendation.
- **Brand posture:** carries a **light HeyHenry brand** (a small wordmark/logo + the Paper palette), trustworthy and clean — **not** the dashboard shell, **not** the operator's branding. It inherits the minimal `(public)/layout.tsx` (white field, "Powered by HeyHenry" footer, no nav/sidebar/auth). Repaint the body to Paper; keep it featherweight and fast (`force-dynamic`, server-rendered, no heavy JS).
- **Valid code:** the social-proof pill — **"{tenant_name} uses HeyHenry"** (repaint off `green-50` onto a calm Paper-soft tone) → headline "Run your contracting business smarter" → "{tenant_name} invited you to try HeyHenry... Start your free 14-day extended trial." → four value bullets (quote builder · scheduling/photos/logs · one-click invoicing · AI assistant) → **one** primary CTA "Start your free 14-day trial" → `/signup?ref={code}` → "No credit card required. Set up in under 5 minutes." Keep the structure; **rust the single CTA** (replace the `#0a0a0a` button), Paper-tint the pill and check glyphs.
- **Invalid / expired code (target — currently a silent anonymous fallback):** when `findReferralCodeByCode` returns null, **don't pretend** — show a graceful "This referral link isn't active anymore — but you can still try HeyHenry free" with the generic CTA. Acknowledge the dead link rather than swapping copy invisibly.
- **"Client" not "homeowner":** the bullet copy describes running a contracting business; ensure any customer-facing language says **"client,"** never "homeowner."
- **No operator data leak:** only `tenant_name` is exposed (enforced by `findReferralCodeByCode`'s narrow select + anon RLS). Never surface the referrer's email, stats, internal IDs, or anything beyond the business name.
- **Missing scaffolding (target):** add a `loading.tsx` (Paper skeleton) and a real `not-found` / invalid state to the `/r` route group.

## Role variations
- **Owner / admin:** the full Refer & Earn page (link, invite, stats, history, offer). This is an account-level growth surface in the personal nav.
- **Member (crew):** **open question** — does a crew member get their own referral page? The nav item is seeded per vertical pack, not obviously role-gated. Likely **owner/admin only** (the reward accrues to the business/account, not an individual employee), but **confirm against Role × Object Matrix** before build. Don't design a member view until decided.
- **Worker (`/w`):** **N/A** — not in the worker app.
- **Prospective contractor (public landing):** sees only the brand-light landing + the business name. Never authenticated, never sees operator chrome or data.
- **Client / homeowner:** **N/A** — clients never reach any part of this feature. A referral invites a *peer contractor*, not a client.

## Mobile vs desktop
*"Share a link from the phone"* is the primary real-world path — a contractor texting a buddy from the truck. **Mobile must be first-class.**
- **Desktop:** the stacked page (share hero → offer → stats → history table). History as a table.
- **Mobile (the money path):** the **share hero is the whole first screen** — link + the **Share** button (`navigator.share` opens the native sheet → Messages/WhatsApp/email in one tap; this is *the* mobile flow, far more than typing an email). Copy + Share buttons ≥44px. The invite forms stack below (single-column, `min-w-0`, ≥44px send buttons). **Stats → 2-up** (`grid-cols-2`, already responsive). **History → stacked cards, not a table** (PATTERNS §18): each card = Contact (line 1) + Status badge (right) + Date (line 2, tenant-tz); auto-height, no fixed-height overflow. The public landing is already centered/responsive — keep, repaint, verify the single CTA is thumb-reachable.

## Financial / Canadian
- **The reward is CAD** — **$300 CAD** flat bounty (tier_3). Render any reward figure via `Money` (CAD, tabular-nums); the current bare `$${stats.rewards}` and `$300` string literals should be CAD-aware. **But:** the reward balance is `0` placeholder and the payout pipeline doesn't exist — don't render a live "$X earned" balance as real money until it does (see §gap 2).
- **No GST/HST, no Interac, no holdback** on this surface — it's not an invoice or a payment. (If a reward is ever paid as account credit vs. e-Transfer, that's a Settings ▸ Billing concern, not here.)
- **Reward tax note (defer):** a $300 referral bounty paid to a Canadian business may be reportable income — out of scope for the UI, but flag for whoever builds the payout pipeline.

## States
**Referral state vocabulary → `status-tokens` (target — replace the raw shadcn variants in `referral-history.tsx`):**
- **`pending`** (invite sent, no signup yet) → **`info`** (in-flight, awaiting external) — label **"Sent"** or **"Invited."**
- **`signed_up`** (referee created an account) → **`success`** (positive — they joined) — label **"Signed up."**
- **`converted`** (referee became paying — *not wired today*) → **`success`** or **`done`** — label **"Converted."** *(Target.)*
- **`churned`** (referee cancelled — *not wired today*) → **`neutral`** — label **"Churned."** *(Target.)*
- **Reward sub-state** (if surfaced): `reward_status` `earned/applied` → a quiet **`success`** chip ("Reward earned" / "Credit applied"); `pending/expired` → `neutral`. *(All target — never advanced today.)*
- Pair every badge with its glyph (`statusToneIcon`) — never color alone (WCAG 1.4.1).

**Page states:**
- **Empty (no referrals yet — the default for most operators):** the share hero is the empty state by design — link + invite are always present and actionable. The history card shows the existing calm line: **"No referrals yet. Share your link or send an invite to get started."** (keep; repaint). Stats read 0 / 0 (and the honest "—" or "coming" for the unbuilt Conversions/Rewards cards). Don't show a dead empty table.
- **Pending (invites out, no signups):** history rows badge **Sent** (`info`); Signups stat still 0. Calm — no "waiting..." anxiety framing.
- **Signed up (the win):** history rows badge **Signed up** (`success`); Signups stat increments. This is the real, wired success state — let it feel quietly good (Paper, not confetti).
- **Rewarded (target — DO NOT design as shipping in V1):** would badge **Converted** + a reward chip and light the Rewards stat. **Gate behind the payout pipeline existing.** Until then, the Conversions/Rewards cards are honestly "coming," not fake zeros dressed as balances.
- **Loading:** `referrals/loading.tsx` skeleton exists (header + link card + invite + 4 stat cards + 3 history rows) — keep, repaint to Paper muted. **Add a `loading.tsx` to `/r/[code]`** (currently none).
- **Error:** invite send failures surface via `sonner` toast from the `{ ok, error }` action shape (keep, PATTERNS §5). Action read-failures fall back to safe defaults (empty link/stats/history) — the page never hard-errors.
- **Public landing — invalid/expired code:** the graceful "link isn't active anymore, try free anyway" state (target — see §public landing).

## Subscreen inventory
Every surface this screen spawns. The operator page's subscreens are **light — all spec inline.** The public landing is a **distinct sub-route** (spec'd inline above, owned here). The **reward-payout pipeline graduates** to its own row.

**Inline / transient (operator page)**
- **Copy-link** — `ReferralLinkCard` copy button → clipboard write + check-state + toast. Inline, no modal.
- **Native share sheet** — `navigator.share` (mobile) → OS share UI; copy-fallback on unsupported. Transient, OS-owned.
- **Send-invite (email)** — `SendReferralForm` email row → `sendReferralEmailAction` → pending state + toast; creates a `pending` referral row + sends the CASL-tagged email. Inline.
- **Send-invite (SMS)** — phone row → E.164 normalize → `sendReferralSMSAction` → pending state + toast; creates a `pending` row + sends the SMS. Inline.
- **Henry invite-note draft** *(target)* — a `✦` "Draft a note" affordance + editable text in the invite block; never auto-sends. Inline (light).

**Disclosure / read**
- **Offer fine print** — `AffiliateOfferCard`'s clawback/eligibility terms; visible inline (small, quiet). Tier-gated copy swap (tier_3 ↔ tier_1/2).
- **History table ↔ mobile cards** — the same data, table on desktop / stacked cards on mobile (§Mobile).

**Sub-routes**
- **`/r/[code]`** (public referral landing) — **owned by this brief**, spec'd inline above. Light enough to spec inline (a single server-rendered marketing page); add `loading.tsx` + invalid-code state. *(Not a graduate — but it IS a separate design pass / OD prompt from the operator page because the brand posture differs entirely.)*

**Graduates to its own pipeline row + brief**
- **Reward / conversion + payout pipeline** — the business logic that flips `signed_up → converted`, advances `reward_status` (`pending → earned → applied`), enforces the 90-day-active + operationally-distinct + clawback rules, and credits/pays the $300 (account credit vs. e-Transfer, ties to Settings ▸ Billing + a tax note). **This is real money + real eligibility logic, not a UI repaint** — it must not ride in on this brief. Graduate it; the present brief only specs how its *states* would render once it exists, and explicitly says **don't fake them in V1.**

## Accessibility
WCAG 2.2 AA. Status badges through `status-tokens` carry both color **and** glyph (never color-alone). Copy / Share / Send / CTA are real buttons, keyboard-operable, with visible focus rings, **≥44px** on mobile. The read-only link `Input` is labeled and selectable. Form inputs (email/phone) have real `<Label>`s (they do — keep). Dates render in tenant tz via `formatDate` (fix the bare `Intl` call). The public landing: near-black ink on the Paper field (high contrast), the single CTA has an accessible name and large hit target, semantic heading order (`h1` → bullets). Toasts (`sonner`) are announced; don't make a toast the *only* signal for a destructive or important outcome.

## Reject-if self-check (per `heyhenry-design-critique`)
- ✅ Grounded in real schema/actions (the built page, the real `status`/`reward_status` enums, the wired `pending→signed_up` flip — and honest that `converted`/reward are **not** wired). ✅ Calm, non-pushy — no leaderboard, no MLM energy, recommendation-not-bounty tone. ✅ Henry = embedded leverage (draft the note), not chat. ✅ No per-seat anything. ✅ "Client" not "homeowner" in landing copy. ✅ Public landing brand-light + trustworthy, leaks only `tenant_name`. ✅ Canadian reward = CAD, honestly. ✅ Mobile share-first (the real path). ⚠ Watch: **do not design a triumphant reward/earned state as if it ships in V1** — the payout pipeline is unbuilt; gate it. ⚠ Watch: rust is the ONE accent — kill the emerald/green money-coding. ⚠ Keep it low-priority — this is a V1.1 candidate, not GC-critical; don't let the reward pipeline scope-creep into V1.

## Open questions
- **Reward pipeline existence.** Nothing flips `converted` or advances `reward_status` today, and `rewards` is a hard-coded 0. Decision: ship the page **honestly stating reward/conversion is "coming"** (recommended for V1.1 repaint), vs. build the full payout pipeline first (graduates — heavy, real money, eligibility rules, Settings ▸ Billing tie-in). The brief assumes the former.
- **Member access.** Is Refer & Earn owner/admin-only, or does a crew member get it too? (Role × Object Matrix — confirm; reward accrues to the account, so likely owner/admin.)
- **CASL attestation (Phase B).** The send path rides the `response_to_request` personal-relationship exemption with `caslEvidence`, but the code comments call for **capturing an explicit referrer attestation at submit time** ("I personally know this contact"). Add a checkbox/affirmation to the invite flow? (Compliance call — flagged in `referrals.ts`.)
- **Two invite forms vs. one.** Keep the separate email + SMS rows, or collapse to one "invite by email or text" card with a channel toggle + the Henry-drafted note? (Lean toward one calmer block.)
- **Stats honesty treatment.** Drop the two always-0 cards (Conversions, Rewards) until wired, or keep them with a quiet "coming" label? (Lean drop-to-two until the pipeline exists.)
- **"Who to refer" nudge.** Worth building the Contacts-sourced suggestion, or does it tip the surface into pushy? (Defer past V1.1; test before adding — this is the line where growth becomes nagging.)
- **Affiliate tier surfacing.** The `affiliate` code type + tier_1/2 partner agreements exist but are sparse in the UI (just the offer-card copy swap). Does any partner ever need richer tooling here, or do partners live outside this page entirely? (Probably outside — confirm there's no hidden partner-dashboard requirement.)
