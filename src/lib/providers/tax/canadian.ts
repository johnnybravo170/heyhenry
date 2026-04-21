/**
 * Canadian tax provider.
 *
 * Reads `gst_rate` and `pst_rate` off the tenant row. This mirrors the
 * existing logic scattered across quote/invoice code; centralizing it here
 * lets new features call `computeTax()` without knowing about GST/PST
 * columns, and lets a future US tenant get `UsTaxProvider` by region
 * without touching calling code.
 *
 * Existing call sites that read gst_rate/pst_rate directly are not migrated
 * yet -- they'll move to this provider opportunistically.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { TaxComputation, TaxProvider } from '../types';

export class CanadianTaxProvider implements TaxProvider {
  readonly name = 'canadian';

  async computeTax(input: { subtotalCents: number; tenantId: string }): Promise<TaxComputation> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('tenants')
      .select('gst_rate, pst_rate')
      .eq('id', input.tenantId)
      .single();

    if (error || !data) {
      throw new Error(`Failed to load tax rates for tenant ${input.tenantId}`);
    }

    const gstRate = Number(data.gst_rate ?? 0);
    const pstRate = Number(data.pst_rate ?? 0);

    const gstCents = Math.round(input.subtotalCents * gstRate);
    const pstCents = Math.round(input.subtotalCents * pstRate);
    const taxCents = gstCents + pstCents;

    const breakdown: TaxComputation['breakdown'] = [];
    if (gstRate > 0) breakdown.push({ label: 'GST', rate: gstRate, amountCents: gstCents });
    if (pstRate > 0) breakdown.push({ label: 'PST', rate: pstRate, amountCents: pstCents });

    return {
      subtotalCents: input.subtotalCents,
      taxCents,
      totalCents: input.subtotalCents + taxCents,
      breakdown,
    };
  }
}
