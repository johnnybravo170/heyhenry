/**
 * MFA status helpers — read-only queries used by server components to
 * render the Settings → Security page.
 *
 * Mutations live in `src/server/actions/mfa.ts`.
 */

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type MfaStatus = {
  enrolled: boolean;
  recoveryCodesRemaining: number;
};

/**
 * Request-deduped via React `cache()`. The Settings → Security page renders
 * BOTH the enrollment card (page) and the MFA enforcement banner (dashboard
 * layout, via getMfaEnforcement) in one render, and each needs this status.
 * Without dedup they'd make two independent `auth.mfa.listFactors()` calls
 * that can disagree under a token-refresh race / eventual consistency —
 * producing a "set up 2FA" banner next to an "already enrolled" card. One
 * call per request guarantees they always agree.
 */
export const getMfaStatus = cache(async (): Promise<MfaStatus | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = !!factors?.totp?.some((f) => f.status === 'verified');

  if (!hasVerifiedTotp) {
    return { enrolled: false, recoveryCodesRemaining: 0 };
  }

  // Count remaining recovery codes via admin client (RLS denies
  // authenticated reads on this table — all access goes through service role).
  const admin = createAdminClient();
  const { count } = await admin
    .from('user_recovery_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('consumed_at', null);

  return { enrolled: true, recoveryCodesRemaining: count ?? 0 };
});
