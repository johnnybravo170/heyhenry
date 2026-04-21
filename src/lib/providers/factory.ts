/**
 * Provider factory.
 *
 * Every feature MUST obtain providers through these functions. Direct SDK
 * imports in feature code defeat the region routing and hot-swap goals.
 *
 * The factory caches instances per region. Region is resolved from the
 * tenant row; callers pass `tenantId` (the common case) or `region`
 * directly (platform admin / webhook handlers).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { StripeConnectPaymentProvider } from './payments/stripe-connect';
import { CanadianTaxProvider } from './tax/canadian';
import type { PaymentProvider, TaxProvider } from './types';

const paymentProviders = new Map<string, PaymentProvider>();
const taxProviders = new Map<string, TaxProvider>();

async function resolveRegion(tenantId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('region')
    .eq('id', tenantId)
    .single();
  if (error || !data) {
    throw new Error(`Failed to resolve region for tenant ${tenantId}`);
  }
  return data.region as string;
}

export async function getPaymentProvider(tenantId: string): Promise<PaymentProvider> {
  const region = await resolveRegion(tenantId);
  return getPaymentProviderForRegion(region);
}

export function getPaymentProviderForRegion(region: string): PaymentProvider {
  const existing = paymentProviders.get(region);
  if (existing) return existing;
  // Single provider per region today. When Helcim lands, dispatch on region
  // (or a per-tenant override column) here.
  const provider = new StripeConnectPaymentProvider(region);
  paymentProviders.set(region, provider);
  return provider;
}

export async function getTaxProvider(tenantId: string): Promise<TaxProvider> {
  const region = await resolveRegion(tenantId);
  const existing = taxProviders.get(region);
  if (existing) return existing;
  const provider = new CanadianTaxProvider();
  taxProviders.set(region, provider);
  return provider;
}
