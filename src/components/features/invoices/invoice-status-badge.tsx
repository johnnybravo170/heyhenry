import { Badge } from '@/components/ui/badge';
import { invoiceStatusTone, statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/lib/validators/invoice';

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn('font-medium capitalize', statusToneClass[invoiceStatusTone[status]])}
      data-slot="invoice-status-badge"
    >
      {status}
    </Badge>
  );
}
