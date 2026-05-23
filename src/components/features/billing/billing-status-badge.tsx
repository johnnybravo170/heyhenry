/**
 * Invoice status badge for the Billing/AR screen.
 *
 * Extends the canonical `invoiceStatusTone` with the derived **overdue**
 * state (status='sent' aged past AR_OVERDUE_DAYS) — danger red + an age
 * suffix ("28d"). Overdue isn't a real DB status, so it lives here rather
 * than in the shared token map.
 */

import { Badge } from '@/components/ui/badge';
import { invoiceStatusTone, statusToneClass, statusToneIcon } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/lib/validators/invoice';

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
    const DangerIcon = statusToneIcon.danger;
    return (
      <Badge
        variant="secondary"
        className={cn('gap-1 font-medium', statusToneClass.danger)}
        data-slot="billing-status-badge"
      >
        <DangerIcon aria-hidden className="size-3" />
        Overdue
        {typeof overdueDays === 'number' && overdueDays > 0 ? (
          <span className="ml-0.5 border-l border-current/30 pl-1 font-mono text-[11px] tabular-nums">
            {overdueDays}d
          </span>
        ) : null}
      </Badge>
    );
  }

  const tone = invoiceStatusTone[status];
  const Icon = statusToneIcon[tone];
  return (
    <Badge
      variant="secondary"
      className={cn('gap-1 font-medium capitalize', statusToneClass[tone])}
      data-slot="billing-status-badge"
    >
      <Icon aria-hidden className="size-3" />
      {status}
    </Badge>
  );
}
