import { StatusBadge } from '@/components/ui/status-badge';
import { invoiceStatusTone, statusToneIcon } from '@/lib/ui/status-tokens';
import type { InvoiceStatus } from '@/lib/validators/invoice';

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const tone = invoiceStatusTone[status];
  return (
    <StatusBadge
      tone={tone}
      label={status}
      icon={statusToneIcon[tone]}
      data-slot="invoice-status-badge"
    />
  );
}
