import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { DrawGstModeSetting } from '@/components/features/settings/draw-gst-mode-setting';
import { InvoicingDefaultsForm } from '@/components/features/settings/invoicing-defaults-form';
import { requireTenant } from '@/lib/auth/helpers';
import { requireRole } from '@/lib/auth/role-guard';
import { type InvoicingPrefs, resolveDrawGstMode } from '@/lib/invoices/draw-gst-mode';
import { getPrefs } from '@/lib/prefs/tenant-prefs';
import { createClient } from '@/lib/supabase/server';

export default async function InvoicingSettingsPage() {
  const { tenant } = await requireTenant();
  requireRole(tenant, ['owner', 'admin']);

  const supabase = await createClient();
  const [{ data }, invoicingPrefs] = await Promise.all([
    supabase
      .from('tenants')
      .select('invoice_payment_instructions, invoice_terms, invoice_policies')
      .eq('id', tenant.id)
      .single(),
    getPrefs<InvoicingPrefs>(tenant.id, 'invoicing'),
  ]);
  // No project override at the tenant level — resolve falls to the tenant
  // default (or 'inclusive' when unset).
  const drawGstMode = resolveDrawGstMode(null, invoicingPrefs.drawGstMode);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Invoicing</h1>
        <p className="text-sm text-muted-foreground">
          Default text shown on every invoice and draw you send.
        </p>
      </div>

      <DrawGstModeSetting initial={drawGstMode} />

      <InvoicingDefaultsForm
        initial={{
          payment_instructions: (data?.invoice_payment_instructions as string | null) ?? null,
          terms: (data?.invoice_terms as string | null) ?? null,
          policies: (data?.invoice_policies as string | null) ?? null,
        }}
      />
    </div>
  );
}
