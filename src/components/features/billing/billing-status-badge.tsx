/**
 * Invoice status badge for the Billing/AR screen.
 *
 * Extends the canonical `invoiceStatusTone` with the derived **overdue**
 * state (status='sent' aged past AR_OVERDUE_DAYS) — danger red + an age
 * suffix ("28d"). Overdue isn't a real DB status, so it lives here rather
 * than in the shared token map.
 */

import { StatusBadge } from '@/components/ui/status-badge';
import { invoiceStatusTone } from '@/lib/ui/status-tokens';
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
    // Age suffix rendered as a child span so the separator and tabular
    // numeral stay visually distinct from the "OVERDUE" label text.
    return (
      <StatusBadge tone="danger" data-slot="billing-status-badge">
        Overdue
        {typeof overdueDays === 'number' && overdueDays > 0 ? (
          <span className="ml-1 border-l border-current/30 pl-1 tabular-nums">{overdueDays}d</span>
        ) : null}
      </StatusBadge>
    );
  }

  const tone = invoiceStatusTone[status];
  return <StatusBadge tone={tone} label={status} data-slot="billing-status-badge" />;
}
