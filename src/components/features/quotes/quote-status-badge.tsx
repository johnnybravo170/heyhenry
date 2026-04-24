import { Badge } from '@/components/ui/badge';
import { quoteStatusTone, statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import { type QuoteStatus, quoteStatusLabels } from '@/lib/validators/quote';

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
      className={cn('font-medium border', statusToneClass[quoteStatusTone[status]], className)}
    >
      {quoteStatusLabels[status]}
    </Badge>
  );
}
