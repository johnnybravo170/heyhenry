'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * Server-paginated footer for the overhead-expense ledger. Page lives in the
 * URL (`?page=`) alongside the active filters; preserves all other params.
 * Renders inside the table card's bottom strip, hidden when one page.
 */
export function ExpensesPager({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function href(nextPage: number): string {
    const params = new URLSearchParams(searchParams?.toString());
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    const qs = params.toString();
    return qs ? `/expenses?${qs}` : '/expenses';
  }

  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-between border-t px-4 py-2.5">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground tabular-nums">
        <span className="font-semibold text-foreground">
          {firstRow}–{lastRow}
        </span>{' '}
        of <span className="font-semibold text-foreground">{total}</span>
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground tabular-nums">
            Page {page} / {totalPages}
          </span>
          <Button
            asChild={hasPrev}
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            aria-label="Previous page"
          >
            {hasPrev ? (
              <Link href={href(page - 1)}>
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span>
                <ChevronLeft className="size-4" />
              </span>
            )}
          </Button>
          <Button
            asChild={hasNext}
            variant="outline"
            size="sm"
            disabled={!hasNext}
            aria-label="Next page"
          >
            {hasNext ? (
              <Link href={href(page + 1)}>
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span>
                <ChevronRight className="size-4" />
              </span>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
