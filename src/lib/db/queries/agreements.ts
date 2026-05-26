/**
 * Read-side helpers for the agreement_acceptances ledger.
 *
 * Uses the admin client: acceptance status gates the onboarding/checkout flow
 * before a tenant context is fully established, and the lookup is a simple
 * existence check the RLS-scoped client would also satisfy.
 */

import { type AgreementType, getAgreement } from '@/lib/agreements/registry';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Has this tenant signed the CURRENT version of the given agreement? A
 * version bump in the registry flips this back to false so the tenant is
 * re-prompted to sign the new terms.
 */
export async function hasAcceptedCurrentAgreement(
  tenantId: string,
  type: AgreementType,
): Promise<boolean> {
  const { version } = getAgreement(type);
  const admin = createAdminClient();
  const { data } = await admin
    .from('agreement_acceptances')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('agreement_type', type)
    .eq('agreement_version', version)
    .limit(1)
    .maybeSingle();
  return !!data;
}
