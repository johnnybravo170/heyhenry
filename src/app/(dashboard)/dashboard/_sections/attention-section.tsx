import { ChecklistDashboardChip } from '@/components/features/checklist/dashboard-chip';
import { CommandCenter, PersonalTasksCard } from '@/components/features/dashboard/command-center';
import { EstimateCelebrationCard } from '@/components/features/dashboard/estimate-celebration-card';
import { MoneyAtRiskCard } from '@/components/features/dashboard/money-at-risk-card';
import { getCurrentUser, requireTenant } from '@/lib/auth/helpers';
import { listPendingChangeOrdersForDashboard } from '@/lib/db/queries/change-orders';
import { getPendingEstimateCelebration } from '@/lib/db/queries/estimate-celebrations';
import { listMoneyAtRisk } from '@/lib/db/queries/money-at-risk';
import {
  getDashboardTaskBuckets,
  getJobTaskHealth,
  listTasksAwaitingVerification,
} from '@/lib/db/queries/tasks';

export async function AttentionSection() {
  const { tenant } = await requireTenant();
  const user = await getCurrentUser();
  const isRenovation = tenant.vertical === 'renovation' || tenant.vertical === 'tile';

  const [celebration, taskBuckets, jobTaskHealth, pendingChangeOrders, tasksToVerify, moneyAtRisk] =
    await Promise.all([
      getPendingEstimateCelebration(),
      user
        ? getDashboardTaskBuckets(user.id)
        : Promise.resolve({
            dueToday: [],
            overdue: [],
            blockedClient: [],
            blockedMaterial: [],
            blockedSub: [],
            blockedOther: [],
            personalTop: [],
          }),
      getJobTaskHealth(),
      listPendingChangeOrdersForDashboard(),
      listTasksAwaitingVerification(),
      listMoneyAtRisk(tenant.id),
    ]);

  // This section streams several stacked cards (triage grid, money-at-risk,
  // personal to-do) into a single drag-sortable slot. The slot wrapper
  // (SortableSection) provides no spacing, so without this container the cards
  // butt together with no vertical gap. flex-col gap-6 gives them the same
  // rhythm as the dashboard's top-level sections — and more space than the
  // triage row's internal gap-4, so each card reads as its own group.
  return (
    <div className="flex flex-col gap-6">
      {celebration ? <EstimateCelebrationCard celebration={celebration} /> : null}
      <ChecklistDashboardChip />
      <CommandCenter
        buckets={taskBuckets}
        jobHealth={jobTaskHealth}
        changeOrdersPending={pendingChangeOrders}
        tasksToVerify={tasksToVerify}
        showJobHealth={!isRenovation}
      />
      <MoneyAtRiskCard rows={moneyAtRisk} />
      <PersonalTasksCard tasks={taskBuckets.personalTop} />
    </div>
  );
}
