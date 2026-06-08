'use client';

/**
 * Filter bar for the overhead-expense ledger (/expenses) — period · category
 * · vendor · payment-source selects + an "uncategorized only" toggle + a
 * debounced search, all URL-state (`?from=&to=&period=&category=&vendor=
 * &source=&uncat=1&q=`). Mirrors the Billing/Contacts filter-bar pattern
 * (PATTERNS §9): native <select>s, chips on the toggle, search resets the
 * pager to page 1. Every change drops `?page` so filtering never strands the
 * user on an out-of-range page.
 *
 * Server-side: the page reads these params and pushes them into
 * `listOverheadExpensesPage` — no client filtering.
 */

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import type { CategoryPickerOption } from '@/lib/db/queries/expense-categories';
import type { PaymentSourceLite } from '@/lib/db/queries/payment-sources';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 300;

export type ExpensePeriodPreset = {
  key: string;
  label: string;
  from: string;
  to: string;
};

type Props = {
  periods: ExpensePeriodPreset[];
  activePeriodKey: string | null;
  categories: CategoryPickerOption[];
  activeCategoryId: string | null;
  vendors: string[];
  activeVendor: string | null;
  paymentSources: PaymentSourceLite[];
  activeSourceId: string | null;
  uncategorizedOnly: boolean;
  uncategorizedCount: number;
  defaultQuery: string;
};

const selectClass =
  'h-8 rounded-full border border-input bg-card px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring';

export function ExpensesFilterBar({
  periods,
  activePeriodKey,
  categories,
  activeCategoryId,
  vendors,
  activeVendor,
  paymentSources,
  activeSourceId,
  uncategorizedOnly,
  uncategorizedCount,
  defaultQuery,
}: Props) {
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
      startTransition(() => router.replace(`/expenses?${params.toString()}`));
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, paramsString, router]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams?.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    startTransition(() => router.replace(`/expenses?${params.toString()}`));
  }

  function setPeriod(key: string) {
    const params = new URLSearchParams(searchParams?.toString());
    params.delete('page');
    params.delete('from');
    params.delete('to');
    if (key === 'all') params.delete('period');
    else params.set('period', key);
    startTransition(() => router.replace(`/expenses?${params.toString()}`));
  }

  function toggleUncategorized() {
    const params = new URLSearchParams(searchParams?.toString());
    params.delete('page');
    if (uncategorizedOnly) params.delete('uncat');
    else params.set('uncat', '1');
    startTransition(() => router.replace(`/expenses?${params.toString()}`));
  }

  function resetAll() {
    setQuery('');
    startTransition(() => router.replace('/expenses'));
  }

  const hasAnyFilter =
    !!activePeriodKey ||
    !!activeCategoryId ||
    !!activeVendor ||
    !!activeSourceId ||
    uncategorizedOnly ||
    !!query;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:flex-wrap md:items-center">
      <div className="flex flex-wrap items-center gap-2">
        {/* Period */}
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Period</span>
          <select
            aria-label="Period"
            value={activePeriodKey ?? 'all'}
            onChange={(e) => setPeriod(e.target.value)}
            className={cn(selectClass, activePeriodKey && 'border-border bg-muted')}
          >
            <option value="all">Period · All time</option>
            {periods.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {/* Category */}
        <select
          aria-label="Category"
          value={activeCategoryId ?? ''}
          onChange={(e) => setParam('category', e.target.value || null)}
          className={cn(selectClass, activeCategoryId && 'border-border bg-muted')}
        >
          <option value="">Category · All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id} disabled={c.isParentHeader}>
              {c.label}
              {c.isParentHeader ? ' (sub-accounts below)' : ''}
            </option>
          ))}
        </select>

        {/* Vendor */}
        <select
          aria-label="Vendor"
          value={activeVendor ?? ''}
          onChange={(e) => setParam('vendor', e.target.value || null)}
          className={cn(selectClass, activeVendor && 'border-border bg-muted')}
        >
          <option value="">Vendor · All</option>
          {vendors.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        {/* Payment source */}
        <select
          aria-label="Paid by"
          value={activeSourceId ?? ''}
          onChange={(e) => setParam('source', e.target.value || null)}
          className={cn(selectClass, activeSourceId && 'border-border bg-muted')}
        >
          <option value="">Paid by · All</option>
          {paymentSources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
              {s.last4 ? ` ····${s.last4}` : ''}
            </option>
          ))}
        </select>

        {/* Uncategorized toggle */}
        <button
          type="button"
          onClick={toggleUncategorized}
          aria-pressed={uncategorizedOnly}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
            uncategorizedOnly
              ? 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'border-input bg-card text-foreground hover:bg-muted',
          )}
        >
          {uncategorizedOnly ? (
            <span aria-hidden className="size-1.5 rounded-full bg-amber-600" />
          ) : null}
          Uncategorized only
          <span className="font-mono text-[11px] tabular-nums opacity-70">
            {uncategorizedCount}
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="relative flex items-center md:ml-auto md:w-72">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Vendor or description…"
          className="h-8 w-full pl-9 pr-9"
          aria-label="Search expenses"
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

      {hasAnyFilter ? (
        <button
          type="button"
          onClick={resetAll}
          className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
