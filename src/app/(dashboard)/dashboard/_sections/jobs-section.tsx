import { TodaysJobs } from '@/components/features/dashboard/todays-jobs';
import { AwaitingApprovalList } from '@/components/features/projects/awaiting-approval-list';
import { requireTenant } from '@/lib/auth/helpers';
import { getProjectsAwaitingApproval } from '@/lib/db/queries/awaiting-approval';
import { getTodaysJobs } from '@/lib/db/queries/dashboard';

export async function JobsSection() {
  const { tenant } = await requireTenant();
  const tz = tenant.timezone;
  const isRenovation = tenant.vertical === 'renovation' || tenant.vertical === 'tile';
  const showTodaysJobs = !isRenovation;

  const [todaysJobs, awaitingApproval] = await Promise.all([
    showTodaysJobs ? getTodaysJobs(tz) : Promise.resolve([]),
    getProjectsAwaitingApproval(),
  ]);

  // Stacks today's-jobs + awaiting-approval into a single drag-sortable slot.
  // The slot wrapper (SortableSection) provides no spacing, so without this
  // container the cards butt together at 0px — flex-col gap-6 matches the
  // dashboard's top-level rhythm (and AttentionSection / MetricsSection).
  return (
    <div className="flex flex-col gap-6">
      {showTodaysJobs ? <TodaysJobs jobs={todaysJobs} timezone={tz} /> : null}
      <AwaitingApprovalList projects={awaitingApproval} variant="compact" />
    </div>
  );
}
