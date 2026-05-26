'use server';

/**
 * Record a signed agreement acceptance (typed-name e-signature).
 *
 * Inserts into `agreement_acceptances` via the admin client so the IP +
 * user-agent are captured server-side and can't be spoofed by the browser.
 * Only the account owner/admin can sign on behalf of the tenant.
 */

import { headers } from 'next/headers';
import { type AgreementType, getAgreement } from '@/lib/agreements/registry';
import { requireTenant } from '@/lib/auth/helpers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function recordAgreementAcceptanceAction(input: {
  type: AgreementType;
  signatureName: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = input.signatureName?.trim();
  if (!name) return { ok: false, error: 'Please type your full name to sign.' };

  const def = getAgreement(input.type);

  const { user, tenant } = await requireTenant();
  if (tenant.member.role !== 'owner' && tenant.member.role !== 'admin') {
    return { ok: false, error: 'Only the account owner can sign this agreement.' };
  }

  const h = await headers();
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? '').trim() || null;
  const userAgent = h.get('user-agent');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('agreement_acceptances')
    .insert({
      tenant_id: tenant.id,
      user_id: user.id,
      agreement_type: def.type,
      agreement_version: def.version,
      signature_name: name,
      ip_address: ip,
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: 'Could not record your acceptance. Please try again.' };
  }

  return { ok: true, id: data.id as string };
}
