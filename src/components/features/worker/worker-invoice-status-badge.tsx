import type { WorkerInvoiceStatus } from '@/lib/db/queries/worker-invoices';
import { cn } from '@/lib/utils';

const LABELS: Record<WorkerInvoiceStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
};

const STYLES: Record<WorkerInvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  paid: 'bg-green-600 text-white',
};

export function InvoiceStatusBadge({ status }: { status: WorkerInvoiceStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium',
        STYLES[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
