import { TimeExpenseTab } from '@/components/features/projects/time-expense-tab';
import { WorkerInvoicesSection } from '@/components/features/projects/worker-invoices-section';
import { getCurrentTenant, getCurrentUser } from '@/lib/auth/helpers';
import { listExpenses } from '@/lib/db/queries/expenses';
import { getOperatorProfile } from '@/lib/db/queries/profile';
import { getProject } from '@/lib/db/queries/projects';
import { listTimeEntries } from '@/lib/db/queries/time-entries';
import { listInvoicesForProject } from '@/lib/db/queries/worker-invoices';
import { listWorkerProfiles } from '@/lib/db/queries/worker-profiles';
import { createClient } from '@/lib/supabase/server';

export default async function TimeTabServer({ projectId }: { projectId: string }) {
  const [project, user, tenant] = await Promise.all([
    getProject(projectId),
    getCurrentUser(),
    getCurrentTenant(),
  ]);
  if (!project || !tenant) return null;

  const [operatorProfile, timeEntries, expenses, workerInvoices, crewWorkers] = await Promise.all([
    user ? getOperatorProfile(tenant.id, user.id) : null,
    listTimeEntries({ project_id: projectId, limit: 100 }),
    listExpenses({ project_id: projectId, limit: 100 }),
    listInvoicesForProject(project.tenant_id, projectId),
    listWorkerProfiles(project.tenant_id),
  ]);
  const ownerRateCents = operatorProfile?.defaultHourlyRateCents ?? null;

  // Sign receipt URLs for any expense with a storage-backed receipt.
  const supabase = await createClient();
  const expenseReceiptUrls = new Map<string, string>();
  const receiptPaths = expenses
    .map((e) => ({ id: e.id, path: e.receipt_storage_path }))
    .filter((r): r is { id: string; path: string } => !!r.path);
  if (receiptPaths.length > 0) {
    const { data } = await supabase.storage.from('receipts').createSignedUrls(
      receiptPaths.map((r) => r.path),
      3600,
    );
    if (data) {
      for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        if (entry?.signedUrl && !entry.error) {
          expenseReceiptUrls.set(receiptPaths[i].id, entry.signedUrl);
        }
      }
    }
  }
  for (const e of expenses) {
    if (!e.receipt_storage_path && e.receipt_url) {
      expenseReceiptUrls.set(e.id, e.receipt_url);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Worker invoices</h3>
        <WorkerInvoicesSection invoices={workerInvoices} />
      </div>
      <TimeExpenseTab
        projectId={projectId}
        buckets={project.cost_buckets}
        ownerRateCents={ownerRateCents}
        timeEntries={timeEntries.map((e) => {
          const wp = e.worker_profile_id
            ? crewWorkers.find((w) => w.id === e.worker_profile_id)
            : null;
          return {
            id: e.id,
            entry_date: e.entry_date,
            hours: Number(e.hours),
            notes: e.notes ?? null,
            worker_profile_id: e.worker_profile_id ?? null,
            worker_name: wp?.display_name ?? null,
          };
        })}
        expenses={expenses.map((e) => {
          const wp = e.worker_profile_id
            ? crewWorkers.find((w) => w.id === e.worker_profile_id)
            : null;
          return {
            id: e.id,
            expense_date: e.expense_date,
            amount_cents: e.amount_cents,
            vendor: e.vendor ?? null,
            description: e.description ?? null,
            bucket_id: (e as { bucket_id: string | null }).bucket_id ?? null,
            worker_profile_id: e.worker_profile_id ?? null,
            worker_name: wp?.display_name ?? null,
            receipt_url: expenseReceiptUrls.get(e.id) ?? null,
          };
        })}
      />
    </div>
  );
}
