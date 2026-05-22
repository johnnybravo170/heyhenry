'use client';

/**
 * Search + kind/subtype filter for the contacts list.
 *
 * State lives in the URL (`?q=…&kind=…&type=…`) so links are shareable and the
 * browser back button works. Typing is debounced (300ms) so we don't thrash
 * the server on every keystroke. Any filter change resets `page` to 1.
 *
 * Filter hierarchy:
 *   - Kind: All / Lead / Customer / Vendor / Sub-trade / Inspector /
 *     Referral partner / Other. (Agent is de-scoped for the GC vertical — the
 *     kind still exists in the data model, just unsurfaced here.)
 *   - When kind=customer is active, a second row reveals the customer subtype
 *     (Residential / Commercial).
 *
 * PATTERNS.md §9: mobile uses a native <select>, never a horizontal scroll
 * row; desktop keeps the inline chips (all kinds fit).
 */

import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  type ContactKind,
  type CustomerType,
  contactKindLabels,
  contactKinds,
  customerTypeLabels,
} from '@/lib/validators/customer';

const DEBOUNCE_MS = 300;

/** Kinds surfaced in the GC directory — agent is de-scoped (see header). */
const VISIBLE_KINDS = contactKinds.filter((k) => k !== 'agent') as Exclude<ContactKind, 'agent'>[];

/** Customer subtypes for the secondary filter row (agent lives on kind, not here). */
const CUSTOMER_SUBTYPES = ['residential', 'commercial'] as const;

export function CustomerSearchBar({
  defaultQuery,
  kindCounts,
}: {
  defaultQuery: string;
  /** Per-kind tallies for the chip counts (+ `all`). */
  kindCounts?: Partial<Record<ContactKind | 'all', number>>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const [, startTransition] = useTransition();

  const currentKind = useMemo<ContactKind | null>(() => {
    const raw = searchParams?.get('kind');
    if (!raw) return null;
    return (contactKinds as readonly string[]).includes(raw) ? (raw as ContactKind) : null;
  }, [searchParams]);

  const currentSubtype = useMemo<CustomerType | null>(() => {
    const raw = searchParams?.get('type');
    if (raw === 'residential' || raw === 'commercial') return raw;
    return null;
  }, [searchParams]);

  const paramsString = searchParams?.toString();

  // Debounce the search query. Resets pagination on change.
  useEffect(() => {
    const params = new URLSearchParams(paramsString);
    const current = params.get('q') ?? '';
    if (query === current) return;

    const id = setTimeout(() => {
      if (query) params.set('q', query);
      else params.delete('q');
      params.delete('page');
      startTransition(() => {
        router.replace(`/contacts?${params.toString()}`);
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(id);
  }, [query, paramsString, router]);

  function applyKind(next: ContactKind | null) {
    const params = new URLSearchParams(searchParams?.toString());
    if (next) params.set('kind', next);
    else params.delete('kind');
    // Changing kind clears any subtype filter (subtype only meaningful for
    // kind=customer) and resets pagination.
    if (next !== 'customer') params.delete('type');
    params.delete('page');
    startTransition(() => {
      router.replace(`/contacts?${params.toString()}`);
    });
  }

  function applySubtype(next: CustomerType | null) {
    const params = new URLSearchParams(searchParams?.toString());
    if (next) params.set('type', next);
    else params.delete('type');
    // Subtype implies kind=customer.
    params.set('kind', 'customer');
    params.delete('page');
    startTransition(() => {
      router.replace(`/contacts?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex items-center">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, phone, or city…"
          className="h-9 w-full pl-9 pr-9"
          aria-label="Search contacts"
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

      {/* Mobile: native select (PATTERNS §9) */}
      <select
        aria-label="Filter by kind"
        value={currentKind ?? 'all'}
        onChange={(e) =>
          applyKind(e.target.value === 'all' ? null : (e.target.value as ContactKind))
        }
        className="block w-full rounded-md border bg-background px-3 py-2 text-sm md:hidden"
      >
        <option value="all">
          All kinds{typeof kindCounts?.all === 'number' ? ` (${kindCounts.all})` : ''}
        </option>
        {VISIBLE_KINDS.map((k) => (
          <option key={k} value={k}>
            {contactKindLabels[k]}
            {typeof kindCounts?.[k] === 'number' ? ` (${kindCounts[k]})` : ''}
          </option>
        ))}
      </select>

      {/* Desktop: inline chips */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Kind:
        </span>
        <FilterChip
          label="All"
          count={kindCounts?.all}
          active={currentKind === null}
          onClick={() => applyKind(null)}
        />
        {VISIBLE_KINDS.map((k) => (
          <FilterChip
            key={k}
            label={contactKindLabels[k]}
            count={kindCounts?.[k]}
            active={currentKind === k}
            onClick={() => applyKind(k)}
            data-kind={k}
          />
        ))}
      </div>

      {currentKind === 'customer' ? (
        <>
          <select
            aria-label="Filter by customer type"
            value={currentSubtype ?? 'all'}
            onChange={(e) =>
              applySubtype(e.target.value === 'all' ? null : (e.target.value as CustomerType))
            }
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm md:hidden"
          >
            <option value="all">All customers</option>
            {CUSTOMER_SUBTYPES.map((t) => (
              <option key={t} value={t}>
                {customerTypeLabels[t]}
              </option>
            ))}
          </select>
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Type:
            </span>
            <FilterChip
              label="All customers"
              active={currentSubtype === null}
              onClick={() => applySubtype(null)}
            />
            {CUSTOMER_SUBTYPES.map((t) => (
              <FilterChip
                label={customerTypeLabels[t]}
                key={t}
                active={currentSubtype === t}
                onClick={() => applySubtype(t)}
                data-type={t}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  ...rest
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant={active ? 'secondary' : 'outline'}
      size="xs"
      onClick={onClick}
      aria-pressed={active}
      className={cn(active && 'ring-1 ring-primary/20')}
      {...rest}
    >
      {label}
      {typeof count === 'number' ? (
        <span className={cn('ml-1 tabular-nums', active ? 'opacity-70' : 'text-muted-foreground')}>
          {count}
        </span>
      ) : null}
    </Button>
  );
}
