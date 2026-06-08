'use client';

/**
 * Filter bar for the Billing/AR list — status chips + search, URL-state
 * (`?status=&q=`), mirroring the Contacts/Projects filter bars.
 *
 *   - status: single-select chip (All · Draft · Sent · Overdue · Paid · Void).
 *     Overdue is the derived aged-subset of Sent, not a DB status.
 *   - q: debounced search over project / customer / invoice #id8.
 * Any change resets pagination to page 1. Mobile uses a native <select>
 * (PATTERNS §9) — never a horizontal scroll row.
 */

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BillingStatusCounts, BillingStatusFilter } from '@/lib/db/queries/billing';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 300;

const STATUS_OPTIONS: { value: BillingStatusFilter | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
];

export function BillingFilterBar({
  defaultQuery,
  activeStatus,
  statusCounts,
}: {
  defaultQuery: string;
  activeStatus: BillingStatusFilter | null;
  statusCounts: BillingStatusCounts;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const [, startTransition] = useTransition();
  const paramsString = searchParams?.toString();

  // Debounced search → URL. Resets pagination.
  useEffect(() => {
    const params = new URLSearchParams(paramsString);
    const current = params.get('q') ?? '';
    if (query === current) return;
    const id = setTimeout(() => {
      if (query) params.set('q', query);
      else params.delete('q');
      params.delete('page');
      startTransition(() => router.replace(`/invoices?${params.toString()}`));
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, paramsString, router]);

  function applyStatus(next: BillingStatusFilter | null) {
    const params = new URLSearchParams(searchParams?.toString());
    if (next) params.set('status', next);
    else params.delete('status');
    params.delete('page');
    startTransition(() => router.replace(`/invoices?${params.toString()}`));
  }

  function countFor(value: BillingStatusFilter | 'all'): number {
    return statusCounts[value];
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Mobile: native select (PATTERNS §9) */}
      <select
        aria-label="Filter by status"
        value={activeStatus ?? 'all'}
        onChange={(e) =>
          applyStatus(e.target.value === 'all' ? null : (e.target.value as BillingStatusFilter))
        }
        className="block w-full rounded-md border bg-background px-3 py-2 text-sm md:hidden"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({countFor(o.value)})
          </option>
        ))}
      </select>

      {/* Desktop: inline chips */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </span>
        {STATUS_OPTIONS.map((o) => {
          const value = o.value === 'all' ? null : o.value;
          const active = activeStatus === value;
          return (
            <Button
              key={o.value}
              type="button"
              variant={active ? 'secondary' : 'outline'}
              size="xs"
              onClick={() => applyStatus(value)}
              aria-pressed={active}
              className={cn(
                'rounded-full',
                active && 'border-transparent bg-foreground text-background',
              )}
            >
              {o.label}
              <span
                aria-hidden
                className={cn(
                  'ml-1 font-mono text-[11px] tabular-nums',
                  active ? 'opacity-70' : 'text-muted-foreground',
                )}
              >
                {countFor(o.value)}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative flex items-center md:w-80">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Project, customer, or invoice…"
          className="h-9 w-full pl-9 pr-9"
          aria-label="Search billing"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
