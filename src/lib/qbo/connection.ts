import { getCurrentTenant } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';

export type QboConnectionSummary = {
  companyName: string | null;
  realmId: string | null;
  environment: 'sandbox' | 'production' | null;
};

/**
 * Tenant's QuickBooks connection identity for the shared sub-route header.
 * Realm id is the only safe identifier to show — tokens are service-role
 * only and never surfaced.
 */
export async function getQboConnectionSummary(): Promise<QboConnectionSummary> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { companyName: null, realmId: null, environment: null };

  const supabase = await createClient();
  const { data } = await supabase
    .from('tenants')
    .select('qbo_realm_id, qbo_company_name, qbo_environment')
    .eq('id', tenant.id)
    .single();

  return {
    companyName: (data?.qbo_company_name as string) ?? null,
    realmId: (data?.qbo_realm_id as string) ?? null,
    environment: (data?.qbo_environment as 'sandbox' | 'production') ?? null,
  };
}
