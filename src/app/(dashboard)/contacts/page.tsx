import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ContactEmptyState } from '@/components/features/contacts/contact-empty-state';
import { ContactSearchBar } from '@/components/features/contacts/contact-search-bar';
import { ContactTable } from '@/components/features/contacts/contact-table';
import { ContactsDuplicateBanner } from '@/components/features/contacts/contacts-duplicate-banner';
import { ContactsPager } from '@/components/features/contacts/contacts-pager';
import { Button } from '@/components/ui/button';
import { getCurrentTenant } from '@/lib/auth/helpers';
import {
  countCustomers,
  countCustomersByKind,
  findDuplicateContacts,
  getContactSignals,
  listContacts,
} from '@/lib/db/queries/contacts';
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
  const dupesMode = resolvedSearchParams.dupes === '1';
  const hasFilters = Boolean(query || kind || type || dupesMode);

  // Scan for likely duplicates (shared name/email/phone). Drives the Henry
  // banner, and — in `?dupes=1` review mode — narrows the list to the clusters.
  const dupes = await findDuplicateContacts();
  const dupeSignature = `${dupes.totalGroups}-${dupes.ids.length}`;

  const filters = {
    search: query || undefined,
    kind: kind ?? undefined,
    type: type ?? undefined,
    ids: dupesMode ? dupes.ids : undefined,
  };

  const tenant = await getCurrentTenant();
  // Money (AR due) is owner/admin only — crew see activity without dollars.
  const canSeeMoney = tenant?.member.role === 'owner' || tenant?.member.role === 'admin';

  const [customers, grandTotal, kindCounts] = await Promise.all([
    listContacts({ ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    countCustomers(filters),
    countCustomersByKind(),
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
          <h1 className="text-[28px] font-bold tracking-tight">Contacts</h1>
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

      {dupesMode ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/25 bg-[#FEF0E3] px-4 py-2.5 text-sm">
          <span>
            Reviewing{' '}
            <strong className="font-semibold">
              {dupes.totalGroups} possible duplicate{dupes.totalGroups === 1 ? '' : 's'}
            </strong>{' '}
            — open each to merge or correct.
          </span>
          <Link href="/contacts" className="font-medium text-brand hover:underline">
            Clear
          </Link>
        </div>
      ) : dupes.totalGroups > 0 ? (
        <ContactsDuplicateBanner
          totalGroups={dupes.totalGroups}
          sampleName={dupes.groups[0]?.name ?? ''}
          sampleKinds={dupes.groups[0]?.kinds ?? []}
          signature={dupeSignature}
        />
      ) : null}

      {showSearchBar ? (
        <Suspense fallback={null}>
          <ContactSearchBar defaultQuery={query} kindCounts={kindCounts} />
        </Suspense>
      ) : null}

      {showingCount === 0 ? (
        <ContactEmptyState variant={hasFilters ? 'filtered' : 'fresh'} />
      ) : (
        <ContactTable
          contacts={rows}
          nowMs={nowMs}
          footer={
            <ContactsPager
              page={page}
              pageSize={PAGE_SIZE}
              total={grandTotal}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
            />
          }
        />
      )}
    </div>
  );
}
