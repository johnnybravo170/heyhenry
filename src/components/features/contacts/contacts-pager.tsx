'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Server-paginated footer for the contacts directory. Page lives in the URL
 * (`?page=`) alongside the active filters, so links are shareable and Back
 * works.
 *
 * Renders as the table card's footer row (top border, no rounding of its own):
 * left holds the mono range count (`1–10 of 24`), right holds the page
 * indicator (`1 / 3`) flanked by prev/next icon buttons — matching the OD.
 */
export function ContactsPager({
  page,
  pageSize,
  total,
  rangeStart,
  rangeEnd,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** First row index shown on this page (1-based; 0 when empty). */
  rangeStart: number;
  /** Last row index shown on this page. */
  rangeEnd: number;
}) {
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function href(nextPage: number): string {
    const params = new URLSearchParams(searchParams?.toString());
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    const qs = params.toString();
    return qs ? `/contacts?${qs}` : '/contacts';
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const btnClass =
    'inline-grid size-[26px] place-items-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <div className="font-mono text-[11px] tracking-wide text-muted-foreground tabular-nums">
        <span className="font-semibold text-foreground">
          {rangeStart}–{rangeEnd}
        </span>{' '}
        of <span className="font-semibold text-foreground">{total}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {hasPrev ? (
          <Link href={href(page - 1)} aria-label="Previous page" className={btnClass}>
            <ChevronLeft className="size-3" />
          </Link>
        ) : (
          <span aria-disabled className={cn(btnClass, 'opacity-40')}>
            <ChevronLeft className="size-3" />
          </span>
        )}
        <span className="px-2 font-mono text-[11px] text-foreground tabular-nums">
          <span className="font-semibold">{page}</span>
          <span className="mx-1 text-muted-foreground">/</span>
          {totalPages}
        </span>
        {hasNext ? (
          <Link href={href(page + 1)} aria-label="Next page" className={btnClass}>
            <ChevronRight className="size-3" />
          </Link>
        ) : (
          <span aria-disabled className={cn(btnClass, 'opacity-40')}>
            <ChevronRight className="size-3" />
          </span>
        )}
      </div>
    </div>
  );
}
