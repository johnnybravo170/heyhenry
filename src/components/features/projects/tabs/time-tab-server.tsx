import { TimeExpenseTab } from '@/components/features/projects/time-expense-tab';
import { WorkerInvoicesSection } from '@/components/features/projects/worker-invoices-section';
import { getCurrentTenant, getCurrentUser } from '@/lib/auth/helpers';
import { getOperatorProfile } from '@/lib/db/queries/profile';
import { getProject } from '@/lib/db/queries/projects';
import { listTimeEntries } from '@/lib/db/queries/time-entries';
import { listInvoicesForProject } from '@/lib/db/queries/worker-invoices';
import { listWorkerProfiles } from '@/lib/db/queries/worker-profiles';

/**
 * Time tab — labour only. Expenses moved to the Costs tab (2026-04-24) so
 * the full cost lifecycle (sub quote → PO → bill → expense) stays together.
 */
export default async function TimeTabServer({ projectId }: { projectId: string }) {
  const [project, user, tenant] = await Promise.all([
    getProject(projectId),
    getCurrentUser(),
    getCurrentTenant(),
  ]);
  if (!project || !tenant) return null;

  const [operatorProfile, timeEntries, workerInvoices, crewWorkers] = await Promise.all([
    user ? getOperatorProfile(tenant.id, user.id) : null,
    listTimeEntries({ project_id: projectId, limit: 100 }),
    listInvoicesForProject(project.tenant_id, projectId),
    listWorkerProfiles(project.tenant_id),
  ]);
  const ownerRateCents = operatorProfile?.defaultHourlyRateCents ?? null;

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
        showExpenses={false}
        expenses={[]}
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
      />
    </div>
  );
}
