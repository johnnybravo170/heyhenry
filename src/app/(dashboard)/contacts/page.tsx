import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ContactsPager } from '@/components/features/customers/contacts-pager';
import { CustomerEmptyState } from '@/components/features/customers/customer-empty-state';
import { CustomerSearchBar } from '@/components/features/customers/customer-search-bar';
import { CustomerTable } from '@/components/features/customers/customer-table';
import { Button } from '@/components/ui/button';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { countCustomers, getContactSignals, listCustomers } from '@/lib/db/queries/customers';
import {
  type ContactKind,
  type CustomerType,
  contactKinds,
  customerTypes,
} from '@/lib/validators/customer';

type RawSearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 50;

function parseKind(value: string | string[] | undefined): ContactKind | null {
  if (typeof value !== 'string') return null;
  return (contactKinds as readonly string[]).includes(value) ? (value as ContactKind) : null;
}

function parseType(value: string | string[] | undefined): CustomerType | null {
  if (typeof value !== 'string') return null;
  return (customerTypes as readonly string[]).includes(value) ? (value as CustomerType) : null;
}

function parseQuery(value: string | string[] | undefined): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== 'string') return 1;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export const metadata = {
  title: 'Contacts — HeyHenry',
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = parseQuery(resolvedSearchParams.q);
  const kind = parseKind(resolvedSearchParams.kind);
  const type = parseType(resolvedSearchParams.type);
  const page = parsePage(resolvedSearchParams.page);
  const hasFilters = Boolean(query || kind || type);

  const filters = {
    search: query || undefined,
    kind: kind ?? undefined,
    type: type ?? undefined,
  };

  const tenant = await getCurrentTenant();
  // Money (AR due) is owner/admin only — crew see activity without dollars.
  const canSeeMoney = tenant?.member.role === 'owner' || tenant?.member.role === 'admin';

  const [customers, grandTotal] = await Promise.all([
    listCustomers({ ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    countCustomers(filters),
  ]);

  const signals = await getContactSignals(
    customers.map((c) => c.id),
    { includeMoney: canSeeMoney },
  );
  const rows = customers.map((c) => ({
    ...c,
    signal: signals.get(c.id) ?? { activeProjects: 0, totalProjects: 0, arDueCents: null },
  }));

  const showingCount = customers.length;
  const rangeStart = grandTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + showingCount;
  // A single server-stable timestamp for any relative-time rendering in the
  // (client) table — passed as a prop so SSR and hydration agree (no Date.now
  // mismatch). The directory shows the search bar whenever a filter is active
  // OR the directory is non-empty, so a zero-result filter never traps the
  // user on a chrome-less page.
  const nowMs = Date.now();
  const showSearchBar = hasFilters || grandTotal > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {!hasFilters && grandTotal === 0
              ? 'Nobody in the system yet.'
              : hasFilters
                ? grandTotal === 0
                  ? 'No matches'
                  : `${rangeStart}–${rangeEnd} of ${grandTotal} contact${grandTotal === 1 ? '' : 's'}`
                : `${grandTotal} contact${grandTotal === 1 ? '' : 's'} on file`}
          </p>
        </div>
        <Button asChild>
          <Link href="/contacts/new">
            <Plus className="size-3.5" />
            New contact
          </Link>
        </Button>
      </header>

      {showSearchBar ? (
        <Suspense fallback={null}>
          <CustomerSearchBar defaultQuery={query} />
        </Suspense>
      ) : null}

      {showingCount === 0 ? (
        <CustomerEmptyState variant={hasFilters ? 'filtered' : 'fresh'} />
      ) : (
        <>
          <CustomerTable customers={rows} nowMs={nowMs} />
          <ContactsPager page={page} pageSize={PAGE_SIZE} total={grandTotal} />
        </>
      )}
    </div>
  );
}
