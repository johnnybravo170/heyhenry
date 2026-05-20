import { InvoicesTab } from '@/components/features/projects/invoices-tab';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { getVarianceReport } from '@/lib/db/queries/cost-lines';
import { type InvoicingPrefs, resolveDrawGstMode } from '@/lib/invoices/draw-gst-mode';
import { getPrefs } from '@/lib/prefs/tenant-prefs';
import { canadianTax } from '@/lib/providers/tax/canadian';
import { createClient } from '@/lib/supabase/server';

export default async function InvoicesTabServer({ projectId }: { projectId: string }) {
  const supabase = await createClient();
  const tenant = await getCurrentTenant();
  const [invoicesRes, variance, projectRes, invoicingPrefs, taxCtx] = await Promise.all([
    supabase
      .from('invoices')
      .select(
        'id, status, doc_type, tax_inclusive, percent_complete, amount_cents, tax_cents, line_items, customer_note, created_at',
      )
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    getVarianceReport(projectId),
    supabase
      .from('projects')
      .select('estimate_status, draw_gst_mode')
      .eq('id', projectId)
      .maybeSingle(),
    tenant
      ? getPrefs<InvoicingPrefs>(tenant.id, 'invoicing')
      : Promise.resolve({} as InvoicingPrefs),
    tenant
      ? canadianTax.getCustomerFacingContext(tenant.id)
      : Promise.resolve({ totalRate: 0 } as { totalRate: number }),
  ]);

  const estimateStatus = (projectRes.data?.estimate_status as string | null) ?? 'draft';
  const projectOverride = (projectRes.data?.draw_gst_mode as string | null) ?? null;
  const drawGstMode = resolveDrawGstMode(projectOverride, invoicingPrefs.drawGstMode);

  return (
    <InvoicesTab
      projectId={projectId}
      contractRevenueCents={variance.estimated_cents}
      estimateApproved={estimateStatus === 'approved'}
      drawGstMode={drawGstMode}
      projectGstModeOverride={projectOverride}
      tenantDefaultGstMode={invoicingPrefs.drawGstMode ?? 'inclusive'}
      taxRate={taxCtx.totalRate ?? 0}
      invoices={(invoicesRes.data ?? []).map((inv) => ({
        id: inv.id as string,
        status: inv.status as string,
        doc_type: ((inv.doc_type as string | null) ?? 'invoice') as 'invoice' | 'draw' | 'final',
        tax_inclusive: Boolean(inv.tax_inclusive),
        percent_complete: (inv.percent_complete as number | null) ?? null,
        amount_cents: inv.amount_cents as number,
        tax_cents: inv.tax_cents as number,
        line_items: (inv.line_items as { total_cents?: number | null }[] | null) ?? null,
        customer_note: inv.customer_note as string | null,
        created_at: inv.created_at as string,
      }))}
    />
  );
}
