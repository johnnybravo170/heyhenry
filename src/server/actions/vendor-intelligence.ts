'use server';

/**
 * Client-callable wrapper for the vendor-suggestion query. Used by the
 * overhead expense form — after the operator types / OCR fills the
 * vendor field, we ask the server "any history for this vendor?" and
 * surface the suggestion inline.
 */

import { getCurrentTenant } from '@/lib/auth/helpers';
import { getVendorSuggestion, type VendorSuggestion } from '@/lib/db/queries/vendor-intelligence';

export async function getVendorSuggestionAction(input: {
  vendor: string;
}): Promise<{ ok: true; suggestion: VendorSuggestion | null } | { ok: false; error: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };
  if (typeof input.vendor !== 'string') {
    return { ok: false, error: 'Vendor is required.' };
  }
  const suggestion = await getVendorSuggestion(tenant.id, input.vendor);
  return { ok: true, suggestion };
}
