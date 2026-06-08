import { StatusBadge } from '@/components/ui/status-badge';
import { quoteStatusTone, statusToneIcon } from '@/lib/ui/status-tokens';
import { type QuoteStatus, quoteStatusLabels } from '@/lib/validators/quote';

export function QuoteStatusBadge({
  status,
  className,
}: {
  status: QuoteStatus;
  className?: string;
}) {
  const tone = quoteStatusTone[status];
  return (
    <StatusBadge
      tone={tone}
      label={quoteStatusLabels[status]}
      icon={statusToneIcon[tone]}
      data-slot="quote-status-badge"
      data-status={status}
      className={className}
    />
  );
}
