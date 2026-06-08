import type { ReactNode } from 'react';
import { WorkerBottomNav } from '@/components/features/worker/worker-bottom-nav';
import { requireWorker } from '@/lib/auth/helpers';
import { TenantProvider } from '@/lib/auth/tenant-context';
import { getOrCreateWorkerProfile } from '@/lib/db/queries/worker-profiles';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function WorkerLayout({ children }: { children: ReactNode }) {
  const { tenant } = await requireWorker();
  const profile = await getOrCreateWorkerProfile(tenant.id, tenant.member.id);
  const admin = createAdminClient();
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('workers_can_invoice_default, workers_can_log_expenses')
    .eq('id', tenant.id)
    .maybeSingle();
  const canInvoice = profile.can_invoice ?? tenantRow?.workers_can_invoice_default ?? false;
  const canLogExpenses = profile.can_log_expenses ?? tenantRow?.workers_can_log_expenses ?? true;

  return (
    <TenantProvider timezone={tenant.timezone}>
      <div className="flex min-h-screen w-full flex-col bg-background">
        <header className="border-border border-b bg-chrome px-4 py-3">
          <p className="font-mono font-bold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
            {tenant.name}
          </p>
        </header>
        {/* pb leaves room for the 64px nav + the raised Log FAB lift + safe area. */}
        <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-[8.5rem]">{children}</main>
        <WorkerBottomNav canInvoice={canInvoice} canLogExpenses={canLogExpenses} />
      </div>
    </TenantProvider>
  );
}
