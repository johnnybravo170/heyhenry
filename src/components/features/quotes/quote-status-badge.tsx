import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type QuoteStatus, quoteStatusLabels } from '@/lib/validators/quote';

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100',
  sent: 'bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-100',
  accepted: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  rejected: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  expired: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
};

export function QuoteStatusBadge({
  status,
  className,
}: {
  status: QuoteStatus;
  className?: string;
}) {
  return (
    <Badge
      data-slot="quote-status-badge"
      data-status={status}
      variant="outline"
      className={cn('font-medium border', STATUS_STYLES[status], className)}
    >
      {quoteStatusLabels[status]}
    </Badge>
  );
}
