import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ChangeOrderStatusBadge } from '@/components/features/change-orders/change-order-status-badge';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { formatDate } from '@/lib/date/format';
import { listChangeOrders } from '@/lib/db/queries/change-orders';
import type { ChangeOrderStatus } from '@/lib/validators/change-order';

/**
 * Per-project "Changes" view, rendered INSIDE the Budget tab (NOT a
 * reintroduced top-level tab — honors decision 6790ef2b + the locked Hub
 * tab IA; internal links keep `?tab=budget`). Lists every CO on the job with
 * its lifecycle status, cost + timeline impact, and date, plus the
 * "+ New change order" entry. The global `/change-orders` route remains the
 * cross-project roll-up.
 *
 * Lifecycle status uses `status-tokens.ts` via `ChangeOrderStatusBadge` —
 * NOT the diff-action palette (that's for edit-action types, not lifecycle).
 */
export async function ProjectChangesSection({
  projectId,
  timezone,
}: {
  projectId: string;
  timezone: string;
}) {
  const changeOrders = await listChangeOrders({ projectId });
  const newHref = `/projects/${projectId}/change-orders/new`;

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Changes</h3>
          <p className="text-xs text-muted-foreground">
            {changeOrders.length === 0
              ? 'Amendments to the signed scope land here.'
              : `${changeOrders.length} change ${changeOrders.length === 1 ? 'order' : 'orders'} on this job.`}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={newHref}>
            <Plus className="size-3.5" />
            New change order
          </Link>
        </Button>
      </header>

      {changeOrders.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No change orders yet. When the scope changes, capture it here.
        </div>
      ) : (
        <ul className="divide-y">
          {changeOrders.map((co) => {
            const detailPath = `/projects/${projectId}/change-orders/${co.id}`;
            return (
              <li key={co.id}>
                <Link
                  href={detailPath}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{co.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(co.created_at, { timezone, style: 'medium' })}
                      {co.timeline_impact_days !== 0
                        ? ` · ${co.timeline_impact_days > 0 ? '+' : ''}${co.timeline_impact_days} day${Math.abs(co.timeline_impact_days) === 1 ? '' : 's'}`
                        : ''}
                    </p>
                  </div>
                  <ChangeOrderStatusBadge status={co.status as ChangeOrderStatus} />
                  <div className="w-24 text-right">
                    <Money cents={co.cost_impact_cents} signed className="text-sm font-medium" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
