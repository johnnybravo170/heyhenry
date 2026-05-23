'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * Server-paginated footer for the Billing list — paginates by project. Page
 * lives in the URL (`?page=`) alongside the active filters. Hidden on one page.
 */
export function BillingPager({
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
  if (totalPages <= 1) return null;

  function href(nextPage: number): string {
    const params = new URLSearchParams(searchParams?.toString());
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    const qs = params.toString();
    return qs ? `/invoices?${qs}` : '/invoices';
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-between px-1">
      <p className="font-mono text-xs text-muted-foreground tabular-nums">
        Page {page} / {totalPages}
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
