'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import type { QuoteStatusCounts } from '@/lib/db/queries/quotes';
import { cn } from '@/lib/utils';
import { type QuoteStatus, quoteStatuses, quoteStatusLabels } from '@/lib/validators/quote';

export function QuoteStatusFilter({ counts }: { counts: QuoteStatusCounts }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get('status') ?? 'all';

  function handleClick(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const chips: { key: string; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    ...quoteStatuses.map((s) => ({
      key: s,
      label: quoteStatusLabels[s],
      count: counts[s as QuoteStatus],
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          type="button"
          key={chip.key}
          onClick={() => handleClick(chip.key)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            current === chip.key
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-muted bg-card text-muted-foreground hover:bg-muted/50',
          )}
        >
          {chip.label}
          <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px] leading-none">
            {chip.count}
          </Badge>
        </button>
      ))}
    </div>
  );
}
