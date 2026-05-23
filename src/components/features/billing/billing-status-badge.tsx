/**
 * Invoice status badge for the Billing/AR screen.
 *
 * Extends the canonical `invoiceStatusTone` with the derived **overdue**
 * state (status='sent' aged past AR_OVERDUE_DAYS) — danger red + an age
 * suffix ("28d"). Overdue isn't a real DB status, so it lives here rather
 * than in the shared token map.
 */

import { invoiceStatusTone, statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/lib/validators/invoice';

// OD `.status`: text-only pill — rounded-full, soft fill + tone text, no
// border, no leading icon. (Matches CostStatusBadge in project-costs-section.)
const PILL = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold';

export function BillingStatusBadge({
  status,
  isOverdue,
  overdueDays,
}: {
  status: InvoiceStatus;
  isOverdue?: boolean;
  /** Whole days overdue — rendered as an age suffix when overdue. */
  overdueDays?: number;
}) {
  if (isOverdue) {
    return (
      <span className={cn(PILL, statusToneClass.danger)} data-slot="billing-status-badge">
        Overdue
        {typeof overdueDays === 'number' && overdueDays > 0 ? (
          <span className="ml-1 border-l border-current/30 pl-1 font-mono text-[11px] tabular-nums">
            {overdueDays}d
          </span>
        ) : null}
      </span>
    );
  }

  const tone = invoiceStatusTone[status];
  return (
    <span
      className={cn(PILL, 'capitalize', statusToneClass[tone])}
      data-slot="billing-status-badge"
    >
      {status}
    </span>
  );
}
