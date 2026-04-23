/**
 * MFA status helpers — read-only queries used by server components to
 * render the Settings → Security page.
 *
 * Mutations live in `src/server/actions/mfa.ts`.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type MfaStatus = {
  enrolled: boolean;
  recoveryCodesRemaining: number;
};

export async function getMfaStatus(): Promise<MfaStatus | null> {
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
}
