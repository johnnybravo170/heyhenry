import { StatusBadge } from '@/components/ui/status-badge';
import type { WorkerInvoiceStatus } from '@/lib/db/queries/worker-invoices';
import { workerInvoiceStatusTone } from '@/lib/ui/status-tokens';

const LABELS: Record<WorkerInvoiceStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
};

export function InvoiceStatusBadge({ status }: { status: WorkerInvoiceStatus }) {
  const tone = workerInvoiceStatusTone[status];
  return <StatusBadge tone={tone} label={LABELS[status]} />;
}
