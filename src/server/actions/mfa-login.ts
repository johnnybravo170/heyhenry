'use server';

/**
 * MFA login actions — challenge at sign-in time, and recovery-code fallback
 * for lost-device recovery.
 *
 * Phase 2 of MFA_PLAN.md. Works in tandem with `loginAction` in auth.ts,
 * which routes password-authed users to `/login/mfa` if they have a
 * verified TOTP factor.
 *
 * Recovery design: recovery codes are assumed to be used when the user has
 * lost their authenticator. Using one REMOVES the TOTP factor entirely and
 * wipes all other recovery codes — the user must re-enroll on their new
 * device. Supabase logs out all sessions when a verified factor is
 * deleted, so the user lands back on `/login` and signs in fresh.
 *
 * Action shape follows PATTERNS.md §5: `{ ok: true; ...data } | { ok: false; error }`.
 */

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type MfaLoginResult = { ok: true } | { ok: false; error: string };

function hashCode(code: string): string {
  return createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
}

/**
 * Verify the 6-digit code at login time. Upgrades the session from aal1
 * to aal2 and redirects to `/dashboard` on success.
 */
export async function challengeLoginMfaAction(input: {
  code: string;
}): Promise<MfaLoginResult | never> {
  const code = String(input.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Enter the 6-digit code.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.find((f) => f.status === 'verified');
  if (!totp) {
    // Nothing to challenge — shouldn't happen if we routed here correctly.
    redirect('/dashboard');
  }

  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
    factorId: totp.id,
  });
  if (challengeErr || !challenge) {
    return { ok: false, error: challengeErr?.message ?? 'Could not create challenge.' };
  }

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyErr) return { ok: false, error: verifyErr.message };

  redirect('/dashboard');
}

/**
 * Recovery-code fallback. Validates the code, then:
 *   1. Marks the code consumed (so it can't be reused even if the wipe
 *      below partially fails).
 *   2. Deletes the TOTP factor via admin API. This logs the user out of
 *      all sessions.
 *   3. Wipes all remaining recovery codes (they're meaningless without
 *      the factor).
 *
 * The user then lands on /login — they sign in fresh and, because the
 * factor is gone, skip straight to the dashboard at aal1 with no MFA.
 * They're nudged to re-enroll on /settings/security.
 */
export async function redeemRecoveryCodeAction(input: {
  code: string;
}): Promise<MfaLoginResult | never> {
  const raw = String(input.code ?? '').trim();
  if (!raw) return { ok: false, error: 'Enter a recovery code.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const admin = createAdminClient();
  const hash = hashCode(raw);

  // Find an unconsumed code matching this hash for this user.
  const { data: match } = await admin
    .from('user_recovery_codes')
    .select('id')
    .eq('user_id', user.id)
    .eq('code_hash', hash)
    .is('consumed_at', null)
    .maybeSingle();

  if (!match) return { ok: false, error: 'That recovery code is invalid or already used.' };

  // Mark consumed first — if the subsequent factor delete fails, the code
  // is still spent, which is the safer failure mode.
  const { error: consumeErr } = await admin
    .from('user_recovery_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', match.id);
  if (consumeErr) {
    return { ok: false, error: `Could not consume recovery code: ${consumeErr.message}` };
  }

  // Delete all TOTP factors for this user. Supabase logs all sessions out
  // when a verified factor is deleted.
  const { data: factorList } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
  const totpFactors = factorList?.factors?.filter((f) => f.factor_type === 'totp') ?? [];
  for (const f of totpFactors) {
    await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
  }

  // Clear out the remaining recovery codes — they're worthless without
  // the factor, and leaving them behind just adds noise.
  await admin.from('user_recovery_codes').delete().eq('user_id', user.id);

  redirect('/login?recovery=1');
}
