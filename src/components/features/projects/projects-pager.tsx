'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * Server-paginated footer for the projects list. Page lives in the URL
 * (`?page=`) alongside the active filters. Renders as the table card's
 * bottom row: mono range count on the left, page nav on the right. Always
 * present (page nav is disabled on a single page) so the card has a footer.
 */
export function ProjectsPager({
  page,
  pageSize,
  total,
  rangeStart,
  rangeEnd,
}: {
  page: number;
  pageSize: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
}) {
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function href(nextPage: number): string {
    const params = new URLSearchParams(searchParams?.toString());
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    const qs = params.toString();
    return qs ? `/projects?${qs}` : '/projects';
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <p className="font-mono text-xs text-muted-foreground tabular-nums">
        Showing {rangeStart}–{rangeEnd} of {total}
      </p>
      <div className="flex items-center gap-2">
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
        <span className="px-1 font-mono text-xs text-muted-foreground tabular-nums">
          {page} / {totalPages}
        </span>
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
    </div>
  );
}
