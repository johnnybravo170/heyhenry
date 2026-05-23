import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { BillingCockpit } from '@/components/features/billing/billing-cockpit';
import { BillingFilterBar } from '@/components/features/billing/billing-filter-bar';
import { BillingPager } from '@/components/features/billing/billing-pager';
import { BillingTable } from '@/components/features/billing/billing-table';
import { InvoiceEmptyState } from '@/components/features/invoices/invoice-empty-state';
import { InvoiceTable } from '@/components/features/invoices/invoice-table';
import { Button } from '@/components/ui/button';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { type BillingStatusFilter, getBillingData } from '@/lib/db/queries/billing';
import { listInvoices } from '@/lib/db/queries/invoices';

export const metadata = {
  title: 'Billing — HeyHenry',
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 25;
const STATUS_VALUES: BillingStatusFilter[] = ['draft', 'sent', 'overdue', 'paid', 'void'];

function parseStatus(value: string | string[] | undefined): BillingStatusFilter | null {
  return typeof value === 'string' && (STATUS_VALUES as string[]).includes(value)
    ? (value as BillingStatusFilter)
    : null;
}

function parseQuery(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== 'string') return 1;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const tenant = await getCurrentTenant();

  // Pressure-washing bills per *job*, not per project — it has no project/draw
  // model, so the project-grouped cockpit doesn't apply. That vertical keeps
  // the flat invoice list. Everything below the fork is GC-only (project-based).
  if (tenant?.vertical === 'pressure_washing') {
    return <PwInvoices />;
  }

  return <GcBilling searchParams={searchParams} canSeeMoney={isMoneyRole(tenant)} />;
}

function isMoneyRole(tenant: Awaited<ReturnType<typeof getCurrentTenant>>): boolean {
  // Money (AR) is owner/admin only — crew use the /w/invoices worker surface.
  return tenant?.member.role === 'owner' || tenant?.member.role === 'admin';
}

/** Flat invoice list for the pressure-washing (job-based) vertical. */
async function PwInvoices() {
  const invoices = await listInvoices();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Track payments for completed jobs.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/invoices/import">
            <Sparkles className="size-3.5" />
            Import with Henry
          </Link>
        </Button>
      </div>
      {invoices.length === 0 ? <InvoiceEmptyState /> : <InvoiceTable invoices={invoices} />}
    </div>
  );
}

/** Project-grouped Billing/AR cockpit for GC verticals (renovation, tile). */
async function GcBilling({
  searchParams,
  canSeeMoney,
}: {
  searchParams: Promise<RawSearchParams>;
  canSeeMoney: boolean;
}) {
  const resolved = await searchParams;
  const status = parseStatus(resolved.status);
  const query = parseQuery(resolved.q);
  const page = parsePage(resolved.page);
  const hasFilters = Boolean(status || query);

  const { positions, cockpit, statusCounts, totalProjects } = await getBillingData({
    status: status ?? undefined,
    search: query || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const directoryEmpty = !hasFilters && statusCounts.all === 0;
  const rangeStart = totalProjects === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + positions.length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          What you&rsquo;re owed — and what&rsquo;s ready to bill.
        </p>
      </header>

      {directoryEmpty ? (
        <InvoiceEmptyState />
      ) : (
        <>
          {canSeeMoney ? <BillingCockpit cockpit={cockpit} /> : null}

          <Suspense fallback={null}>
            <BillingFilterBar
              defaultQuery={query}
              activeStatus={status}
              statusCounts={statusCounts}
            />
          </Suspense>

          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card py-16 text-center">
              <p className="text-sm font-medium">No projects match these filters.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/invoices">Clear filters</Link>
              </Button>
            </div>
          ) : (
            <>
              <BillingTable positions={positions} />
              <p className="px-1 text-xs text-muted-foreground tabular-nums">
                {rangeStart}–{rangeEnd} of {totalProjects} project{totalProjects === 1 ? '' : 's'}
              </p>
              <BillingPager page={page} pageSize={PAGE_SIZE} total={totalProjects} />
            </>
          )}
        </>
      )}
    </div>
  );
}
