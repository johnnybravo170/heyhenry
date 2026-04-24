import type { WorkerInvoiceStatus } from '@/lib/db/queries/worker-invoices';
import { statusToneClass, workerInvoiceStatusTone } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';

const LABELS: Record<WorkerInvoiceStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
};

export function InvoiceStatusBadge({ status }: { status: WorkerInvoiceStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium',
        statusToneClass[workerInvoiceStatusTone[status]],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
