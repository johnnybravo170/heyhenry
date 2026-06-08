# OD Brief — Auth / sign-in (`(auth)`: the front door)

> **Grounded in:** the `src/app/(auth)/*` route group — `layout.tsx` (centered frame: `HeyHenryWordmark` + card + "Built for contractors. Made in Canada." footer; wraps login/signup/magic-link/check-email/callback/onboarding-plan), `login/page.tsx` (email+password + "use magic link" + "sign up"), `magic-link/page.tsx`, `check-email/page.tsx` (← the "Check your inbox" screen), `callback/page.tsx` (OTP landing), `signup/page.tsx` (the tenant-provisioning form), `login/mfa/page.tsx` + `login/mfa/recover/page.tsx`, `join/[code]/page.tsx` (worker/bookkeeper/member invite), `logout/page.tsx`. Actions `src/server/actions/auth.ts` (`loginAction` → password + MFA branch + role-routing; `signupAction` → `signup_tenant()` RPC bootstrap; `requestMagicLinkAction` → `signInWithOtp`, **existing users only**; `logoutAction`), `mfa-login.ts` (`challengeLoginMfaAction`), `worker-auth.ts` (`workerSignupAction`/`workerLoginAndJoinAction`/`joinTenantWithSessionAction`). Helpers `src/lib/auth/{helpers,role-guard,mfa,mfa-enforcement}.ts`; validators `src/lib/validators/auth.ts`; rate-limit `src/lib/rate-limit.ts`. Data: `auth.users` (Supabase Auth), `tenant_members.role` (∈ owner|admin|member|worker|bookkeeper — drives the post-login destination), `tenants` (created at signup via RPC), `worker_invites` (join codes), referral/legal-version columns. Vault: Role × Object Matrix `03b1ccf4` (**role home bases**: owner/admin/member → `/dashboard`, worker → `/w`, bookkeeper → `/bk`, **client = no account**), Positioning `5bfa59be` (the Canadian-built wedge). Siblings: **`onboarding.md`** (the post-signup first-run pass — this brief ends at the handoff to it), `settings-team.md` (where invites are issued + MFA enforced), `worker-app.md` (where the worker lands).
> **How to use:** render the **shared `(auth)` frame** + the core surfaces (login, check-email, signup, the worker join) phone-first; this is the brand's first impression. Then run `heyhenry-design-critique`. **Do NOT redraw onboarding** — it's briefed in `onboarding.md`; auth ends at the redirect into it.
>
> **Governing principle — a calm, fast, trustworthy front door; security is non-negotiable.** This is the first screen anyone sees and it sets the whole tone (Linear-not-Buildertrend) + the **"Built for contractors. Made in Canada."** wedge. Three rules: (1) **route to the right home base** — owner/admin/member → `/dashboard`, worker → `/w`, bookkeeper → `/bk`; signup → onboarding; this role-routing is the spine, not a detail; (2) **clients never authenticate** — the customer portal is slug/`approval_code`, no account (don't add a client login); (3) **preserve the security posture** — per-IP + per-email rate limiting, uniform no-enumeration responses, MFA (aal2), recovery codes. A restyle must not regress any of it.
>
> **Current vs target:** the whole family is built, functional, and reasonably on-brand (consistent frame, wordmark, footer, MFA, role-routing, magic-link fallback, strong rate-limiting). It has simply **never been through the redesign pipeline** — no brief, no render, no rubric pass. **Target (the deltas):** (1) **Paper restyle** — the banners use raw `amber-*`/`green-*`/`primary` (recovery, referral, plan, already-registered); move to status-tokens; confirm the `bg-muted/30` frame is the warm Paper tone; (2) **the password-vs-magic-link question** (below) — login leads with password, magic-link is a "Forgot?" afterthought, which may be backwards for mobile contractors; (3) **mobile-first hardening** — these are opened on phones; (4) **family coherence** — login/signup/mfa share the Card frame, but `join` has its own mode-toggle + tenant-logo header; unify intentionally. **Flagged** throughout.

**Object:** the **session + tenant membership** — getting a person authenticated and into their role's home. · **Roles entering here:** *prospect* (signup → becomes owner), *returning user* (login → role-routed), *invited worker/bookkeeper/member* (join/[code]), *MFA-enrolled user* (extra challenge). · **Primary action:** get in, fast, landed in the right place — minimum friction, maximum trust.

## The surfaces *(one frame, several jobs)*
- **Login** (`/login`) — email + **password**; MFA branch (a verified factor → `/login/mfa`); then `?next=` (same-origin only) or role-routed home. Links: "Forgot? Use magic link" → `/magic-link`; "No account? Sign up". Handles `?recovery=1` (MFA-removed banner) + `?email=` prefill.
- **Magic link** (`/magic-link`) + **Check email** (`/check-email`) — request an OTP sign-in link (existing users only; `shouldCreateUser:false`), land on "Check your inbox" (the screenshot: "We sent a sign-in link to {email}… close this tab", + "Back to sign in"). Link → `/callback` exchanges + routes.
- **Signup** (`/signup`) — the **only tenant-provisioning path**. First/last name, business name, email, **mobile phone** (SMS 6-digit verify), password (8+, letter+number), ToS/Privacy accept. Banners: referral ("trial bumped to 14 days"), plan ("14-day free trial, no card"). **Already-registered → "Sign in instead"** with email prefilled (no dead-end). → `/onboarding` (or `/onboarding/plan` on a paid CTA). Tagline: *"Run your jobs from the truck. We handle the paperwork."*
- **MFA** (`/login/mfa` + `/recover`) — 6-digit TOTP → aal2 → home; "Use a recovery code" / "Cancel" (→ logout). Recover consumes a code, removes MFA, → `/login?recovery=1`.
- **Worker join** (`/join/[code]`) — accept an invite. Shows the **employer's logo + "Join {tenant}"** (their brand, not HeyHenry's). Three paths: already-signed-in → one-click join; existing account → sign in & join; new → create & join (name/email prefilled from the invite). Role-routed home (worker→/w, bookkeeper→/bk, member→/dashboard). Invalid-invite state.
- **Logout** (`/logout`) — sign out → `/login`.

## Progressive disclosure
- **Snapshot:** one card, one obvious action (sign in / create account / join).
- **Operational:** the form; MFA challenge if enrolled.
- **Detail:** the recovery + already-registered + invalid-invite paths — the off-happy-path branches that must never dead-end.
- **Audit:** sign-in events are Supabase Auth's domain; not a UI surface here.

## Henry intelligence touchpoints *(intentionally none — auth is pre-Henry)*
Don't bolt Henry onto the front door. The "Meet Henry" introduction belongs to **onboarding** (`onboarding.md`), after the account exists. Auth stays a clean, fast gate. (Consistent with `[[feedback_henry_intelligence_not_chat]]`.)

## Role variations *(the routing spine)*
- **Prospect → Owner:** signup → onboarding → `/dashboard`. The only path that creates a tenant.
- **Owner / admin / member (returning):** login → `?next=` or `/dashboard`.
- **Worker (returning):** login → `/w`; **(invited):** join → `/w`.
- **Bookkeeper:** login/join → `/bk` (out of redesign scope downstream, but they still sign in here).
- **MFA-enrolled:** any login → `/login/mfa` first.
- **Client:** **never here** — the portal is no-login (slug/`approval_code`). Do not add a client sign-in.

## Mobile vs desktop
**Mobile-first** — contractors and especially workers sign in on phones in the field. Implications: big tap targets, correct `autocomplete`/`inputMode` (already good: `email`/`current-password`/`new-password`/`one-time-code`/`tel`), and **the magic-link path is a mobile gift** (no password typing on a phone) — which feeds the password-vs-magic-link question below.

## Financial / Canadian
- **Trial + plan:** signup frames a **14-day free trial, no card required**; referral bumps it; a paid CTA routes through the plan picker → Stripe (`onboarding/plan`). Honor the **grandfather principle** on any pricing change (`[[feedback_pricing_grandfather_principle]]`).
- **Canadian trust:** "Built for contractors. Made in Canada." is the wedge — keep it on the frame. SMS phone verification (Twilio). No money is moved at auth.

## States
- **Loading:** Suspense + pending button labels ("Signing in…", "Setting things up…", "Joining…").
- **Error:** inline `role="alert"` + toast; rate-limit messages with retry-after; "account created but sign-in failed" edge.
- **Recovery:** `?recovery=1` MFA-removed banner; MFA recover path.
- **Already-registered:** signup → "Sign in instead" with prefilled email (recovery, not dead-end).
- **Invalid/expired invite:** join shows "Invite not valid — contact your employer."
- **Empty:** n/a (forms).

## Subscreen inventory
- **Login** (`/login`) — **MEDIUM → own render** (the hero auth surface).
- **Magic-link request + Check-email** (`/magic-link`, `/check-email`) — **MEDIUM → own render** (the passwordless path; the screenshotted screen).
- **Callback** (`/callback`) — **LIGHT** (transient exchange + redirect; a spinner/"signing you in" state).
- **Signup** (`/signup`) — **HEAVY → own render** (multi-field + plan/referral banners + already-registered recovery).
- **MFA challenge + recover** (`/login/mfa`, `/recover`) — **MEDIUM → own render** (6-digit + recovery-code).
- **Worker join** (`/join/[code]`) — **HEAVY → own render** (3 paths, employer-branded, invalid state).
- **Logout** — **LIGHT** (action → redirect).
- **Onboarding** — **graduated** to `onboarding.md`; not specced here.

## Accessibility
WCAG 2.2 AA: labeled inputs with correct `autocomplete`/`inputMode` (already solid); errors `role="alert"`; the MFA input is `inputMode="numeric"` + `one-time-code` + `autoFocus`; the join mode-toggle (New/Existing) needs proper tab/`role` semantics + keyboard operability; ≥44px targets; the wordmark has an accessible name; focus lands on the first field. Don't lose any of this in a restyle.

## Decisions / Open questions
1. **Password-first vs magic-link-forward (the headline product call).** Login leads with email+password; magic-link is buried as "Forgot?". For mobile contractors with low password discipline, a **magic-link-forward** (or co-equal) sign-in may convert + retain better — and signup already verifies the phone, so identity is established. This is a **positioning/product decision** (owner + Ops), not an OD render choice. Flag, don't silently redesign.
2. **Magic-link signup is deferred (Phase 2)** — signup stays password-only for now (`shouldCreateUser:false`). Confirm that holds for the redesign, or whether passwordless signup comes forward.
3. **Paper restyle of banners** — recovery/referral/plan/already-registered use raw amber/green/primary → status-tokens; confirm the `bg-muted/30` frame reads as warm Paper.
4. **Family coherence** — should `join` adopt the standard card frame more tightly (it has a bespoke mode-toggle + logo header)? Keep the employer-logo header (it's correct — the worker joins their employer's brand).
5. **The "1 Issue" dev chip in the screenshot** — looks like the Next.js dev error indicator, not an auth design issue; worth a separate console-error look if you want, but out of scope for this brief.
