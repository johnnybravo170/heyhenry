import { Badge } from '@/components/ui/badge';
import type { InvoiceStatus } from '@/lib/validators/invoice';

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  void: 'bg-destructive/10 text-destructive',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge
      variant="secondary"
      className={`font-medium capitalize ${STATUS_CLASS[status] ?? 'bg-muted'}`}
      data-slot="invoice-status-badge"
    >
      {status}
    </Badge>
  );
}
