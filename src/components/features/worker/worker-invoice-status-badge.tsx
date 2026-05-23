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
  const tone = workerInvoiceStatusTone[status];
  return (
    <span
      className={cn(
        // OD `.pill`: mono, 10px/700, uppercase, 4px radius, soft fill, no border, no icon.
        'inline-flex items-center whitespace-nowrap rounded border-transparent px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide',
        statusToneClass[tone],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
