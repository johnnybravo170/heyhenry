import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { InvoiceStatusBadge } from '@/components/features/worker/worker-invoice-status-badge';
import { Button } from '@/components/ui/button';
import { requireWorker } from '@/lib/auth/helpers';
import { listInvoicesForWorker } from '@/lib/db/queries/worker-invoices';
import { getOrCreateWorkerProfile } from '@/lib/db/queries/worker-profiles';
import { formatCurrency } from '@/lib/pricing/calculator';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function WorkerInvoicesPage() {
  const { tenant } = await requireWorker();
  const profile = await getOrCreateWorkerProfile(tenant.id, tenant.member.id);

  const admin = createAdminClient();
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('workers_can_invoice_default')
    .eq('id', tenant.id)
    .maybeSingle();
  const canInvoice = profile.can_invoice ?? tenantRow?.workers_can_invoice_default ?? false;
  if (!canInvoice) redirect('/w');

  const invoices = await listInvoicesForWorker(tenant.id, profile.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Button asChild size="sm">
          <Link href="/w/invoices/new">
            <Plus className="size-4" /> New invoice
          </Link>
        </Button>
      </div>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No invoices yet. Tap &ldquo;New invoice&rdquo; to bill unreviewed time &amp; expenses.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/w/invoices/${inv.id}`}
              className="flex items-center justify-between gap-3 p-3 hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <InvoiceStatusBadge status={inv.status} />
                  <span className="text-sm font-medium">{formatCurrency(inv.total_cents)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {inv.period_start} → {inv.period_end}
                  {inv.project_name ? ` · ${inv.project_name}` : ''}
                </p>
                {inv.rejection_reason ? (
                  <p className="text-xs text-red-700">Rejected: {inv.rejection_reason}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
