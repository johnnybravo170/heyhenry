# MFA Plan — HeyHenry

Status: SHIPPED 2026-04-22. Phases 1–3 live on app.heyhenry.io. Phase 4 (migration email) skipped — no existing user base to migrate. Phase 5 (ops.heyhenry.io admin MFA) deferred to PLATFORM_ADMIN_PLAN.md. Phase 3b (per-action step-up re-challenge with 15-min window) deferred — enforcement value is ~90% captured by aal2-on-login.

App handles customer PII, invoices, payment links, and Stripe Connect tokens. TOTP MFA is required before we scale past the first paying tenant.

## 1. Mechanism

Supabase Auth native TOTP (`auth.mfa.enroll` / `challenge` / `verify`). No SMS — TOTP only (Authy, 1Password, Google Authenticator). Recovery codes: generate 10 single-use codes at enrollment, stored hashed in a `user_recovery_codes` table (Supabase doesn't issue these natively).

## 2. Enforcement policy

Two knobs, per tenant:

- **Tenant owner**: MFA **required**. Cannot dismiss the setup prompt. Locked out of sensitive actions (Stripe Connect, billing, team invites, data export) until enrolled.
- **Invited team members**: default **optional**, with a tenant-level toggle `require_mfa_for_all_members` (owner-controlled, off by default). When flipped on, existing unenrolled members get a grace period (see §6).

Rationale: owners hold the keys (Stripe, billing); members may only touch jobs/quotes. Let small crews onboard without friction, but give owners a single switch when they want it hardened.

## 3. Session handling

- Fully-authed session (post-MFA): **30 days** sliding, matching Supabase default refresh.
- Step-up re-challenge for sensitive actions regardless of session age: Stripe Connect changes, billing, adding/removing team members, exporting customer data, changing password or MFA settings. Re-challenge window: 15 minutes.
- `aal2` required on every login after enrollment — no "remember this device."

## 4. Platform admin (ops.heyhenry.io)

MFA **always required, no exceptions, no toggle**. Separate Supabase project or separate auth schema — admin accounts never share the tenant auth table. Session: **8 hours**, no sliding refresh. Every mutation requires fresh `aal2` within 5 minutes. Covered in more depth in `PLATFORM_ADMIN_PLAN.md`; this plan just asserts the rule.

## 5. UX

- **Setup location**: Settings → Security → Two-factor authentication.
- **Enrollment flow**: QR + manual secret → verify 6-digit code → show 10 recovery codes once (download .txt + copy buttons) → confirm "I saved these" checkbox before continuing.
- **Sign-up**: don't block sign-up on MFA. Land user in app, show a dismissable banner + a forced modal on first visit to any sensitive route.
- **Login prompt for existing users**: interstitial after password step once enforcement kicks in.
- **Recovery codes regeneration**: Settings → Security → "Regenerate codes." Requires current TOTP or existing unused recovery code. Invalidates all previous codes.
- **Lost device**: use a recovery code to sign in, then re-enroll. No recovery codes left → email **support@heyhenry.io** (forwards to Jonathan for now; manual identity check + reset MFA in Supabase dashboard).

## 6. Migration

- Ship enrollment UI + recovery codes first. Dark-launch. ✅ (Phase 1)
- Email all existing users: "MFA is coming, set it up now." **Skipped** — no paying customers at launch; test accounts get the banner on next login.
- Owners: 14-day grace period with in-app banner → after, soft-lock sensitive actions until enrolled (they can still view data, not mutate billing/Stripe). ✅ (Phase 3)
- Members: unaffected until their owner flips the tenant toggle; then 14-day grace same pattern. ✅ (Phase 3)
- No forced logout. No account lockout. Grace-period clock starts per-user at first post-deploy login. ✅ (Phase 3)

## Decisions locked

1. **Session length**: 30 days sliding. Confirmed.
2. **Enforcement**: Owners required, workers optional (with owner toggle to require all). Confirmed.
3. **Lost-device recovery email**: support@heyhenry.io, forwarded to Jonathan. Set up forwarder as part of build.
4. **Step-up re-challenge** on sensitive actions (Stripe Connect, billing, team changes, data export, MFA/password changes): 15-minute window. Confirmed.
