import { Sparkles } from 'lucide-react';
import { getCurrentUser, requireTenant } from '@/lib/auth/helpers';
import { listPendingChangeOrdersForDashboard } from '@/lib/db/queries/change-orders';
import { listMoneyAtRisk } from '@/lib/db/queries/money-at-risk';
import { getDashboardTaskBuckets, listTasksAwaitingVerification } from '@/lib/db/queries/tasks';

/**
 * Henry's day-read line under the dashboard greeting — the OD dashboard
 * mobile header's orientation cue ("✦ Henry · 3 things need you today").
 * Streamed in its own Suspense boundary so it never blocks the greeting.
 *
 * Counts the same actionable items the AttentionSection surfaces. It re-reads
 * those queries (a few small RLS-scoped reads per dashboard load); if that
 * ever shows up in profiling, wrap the shared query fns in React `cache()` so
 * this and AttentionSection dedupe within the request.
 */
export async function HenryDayRead() {
  const { tenant } = await requireTenant();
  const user = await getCurrentUser();

  const [buckets, toVerify, changeOrders, moneyAtRisk] = await Promise.all([
    user
      ? getDashboardTaskBuckets(user.id)
      : Promise.resolve({ dueToday: [], overdue: [], personalTop: [] as unknown[] }),
    listTasksAwaitingVerification(),
    listPendingChangeOrdersForDashboard(),
    listMoneyAtRisk(tenant.id),
  ]);

  const count =
    buckets.overdue.length +
    buckets.dueToday.length +
    toVerify.length +
    changeOrders.length +
    moneyAtRisk.length;

  const message =
    count === 0
      ? "you're all caught up."
      : `${count} ${count === 1 ? 'thing needs' : 'things need'} you today.`;

  return (
    <p className="mt-1 flex items-center gap-1.5 text-sm">
      <Sparkles className="size-3.5 shrink-0 text-brand" aria-hidden />
      <span className="font-semibold text-brand">Henry</span>
      <span className="text-muted-foreground">{message}</span>
    </p>
  );
}

export function HenryDayReadSkeleton() {
  return <div className="mt-1 h-5 w-44 animate-pulse rounded bg-muted" />;
}
