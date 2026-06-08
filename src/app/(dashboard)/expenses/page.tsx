import { ChevronRight, Plus, Receipt, Sparkles, Upload } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  type ExpensePeriodPreset,
  ExpensesFilterBar,
} from '@/components/features/expenses/expenses-filter-bar';
import { ExpensesPager } from '@/components/features/expenses/expenses-pager';
import { ExpensesTable } from '@/components/features/expenses/expenses-table';
import { RecurringRulesCard } from '@/components/features/expenses/recurring-rules-card';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { requireTenant } from '@/lib/auth/helpers';
import { formatDate } from '@/lib/date/format';
import {
  buildCategoryTree,
  buildPickerOptions,
  listExpenseCategories,
} from '@/lib/db/queries/expense-categories';
import { listActiveRecurringRules } from '@/lib/db/queries/expense-recurring';
import {
  listOverheadExpensesPage,
  OVERHEAD_LEDGER_PAGE_SIZE,
} from '@/lib/db/queries/overhead-expenses';
import { listPaymentSources, toLite } from '@/lib/db/queries/payment-sources';

export const metadata = {
  title: 'Expenses — HeyHenry',
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Ledger period presets (month / quarter / year, this + last). Distinct from
 * the GST presets — this is a display filter, not a filing window, so it
 * defaults to "all time" (no period param). UTC math, formatted in tenant tz
 * for the labels at call time below.
 */
function ledgerPeriodPresets(today: Date = new Date()): ExpensePeriodPreset[] {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const q = Math.floor(m / 3);
  const prevQ = q === 0 ? { y: y - 1, q: 3 } : { y, q: q - 1 };
  return [
    {
      key: 'this_month',
      label: 'This month',
      from: iso(new Date(Date.UTC(y, m, 1))),
      to: iso(new Date(Date.UTC(y, m + 1, 0))),
    },
    {
      key: 'last_month',
      label: 'Last month',
      from: iso(new Date(Date.UTC(y, m - 1, 1))),
      to: iso(new Date(Date.UTC(y, m, 0))),
    },
    {
      key: 'this_quarter',
      label: `This quarter · Q${q + 1} ${y}`,
      from: iso(new Date(Date.UTC(y, q * 3, 1))),
      to: iso(new Date(Date.UTC(y, q * 3 + 3, 0))),
    },
    {
      key: 'last_quarter',
      label: `Last quarter · Q${prevQ.q + 1} ${prevQ.y}`,
      from: iso(new Date(Date.UTC(prevQ.y, prevQ.q * 3, 1))),
      to: iso(new Date(Date.UTC(prevQ.y, prevQ.q * 3 + 3, 0))),
    },
    {
      key: 'this_year',
      label: `${y}`,
      from: iso(new Date(Date.UTC(y, 0, 1))),
      to: iso(new Date(Date.UTC(y, 11, 31))),
    },
    {
      key: 'last_year',
      label: `${y - 1}`,
      from: iso(new Date(Date.UTC(y - 1, 0, 1))),
      to: iso(new Date(Date.UTC(y - 1, 11, 31))),
    },
  ];
}

export default async function OverheadExpensesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { tenant } = await requireTenant();
  if (tenant.member.role === 'worker') redirect('/w');

  const resolved = await searchParams;
  const tz = tenant.timezone;
  const periods = ledgerPeriodPresets();

  const periodKey = str(resolved.period);
  const activePeriod = periodKey ? periods.find((p) => p.key === periodKey) : null;
  const categoryId = str(resolved.category);
  const vendor = str(resolved.vendor);
  const sourceId = str(resolved.source);
  const uncategorizedOnly = resolved.uncat === '1';
  const search = str(resolved.q);
  const page = Math.max(1, Number.parseInt(str(resolved.page) ?? '1', 10) || 1);

  const filters = {
    from: activePeriod?.from,
    to: activePeriod?.to,
    categoryId: categoryId ?? undefined,
    vendor: vendor ?? undefined,
    paymentSourceId: sourceId ?? undefined,
    uncategorizedOnly,
    search: search ?? undefined,
  };

  const [ledger, recurringRules, categoryRows, sourceRows] = await Promise.all([
    listOverheadExpensesPage(filters, page, OVERHEAD_LEDGER_PAGE_SIZE),
    listActiveRecurringRules(),
    listExpenseCategories(),
    listPaymentSources(),
  ]);

  const pickerOptions = buildPickerOptions(buildCategoryTree(categoryRows));
  const paymentSources = toLite(sourceRows);
  const hasAnyFilter =
    !!activePeriod || !!categoryId || !!vendor || !!sourceId || uncategorizedOnly || !!search;

  // Empty-state discriminator: no rows AND no filters means a genuinely empty
  // ledger (first-run); no rows WITH filters means "nothing matched".
  const isFirstRun = ledger.total === 0 && !hasAnyFilter;

  const periodLabel = activePeriod
    ? `${formatDate(activePeriod.from, { timezone: tz })} — ${formatDate(activePeriod.to, { timezone: tz })}`
    : 'All time';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overhead expenses</h1>
          <p className="text-sm text-muted-foreground">
            Operating costs not tied to a project — fuel, tools, office, insurance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/expenses/gst">
              <Receipt className="size-3.5" />
              GST/HST
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-brand/30 bg-brand/5 text-brand hover:bg-brand/10 hover:text-brand"
          >
            <Link href="/expenses/import">
              <Sparkles className="size-3.5" />
              Import receipts
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/expenses/new">
              <Plus className="size-3.5" />
              Log expense
            </Link>
          </Button>
        </div>
      </header>

      {/* Summary strip — period total · GST claimable · entry count. */}
      {!isFirstRun ? (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Period summary">
          <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Total · {periodLabel}
            </span>
            <Money cents={ledger.summary.amount_cents} className="text-xl" emphasis />
          </div>
          <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              GST/HST claimable
            </span>
            <Money cents={ledger.summary.tax_cents} className="text-xl" emphasis />
          </div>
          <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Entries
            </span>
            <span className="text-xl font-medium tabular-nums">{ledger.total}</span>
            {ledger.summary.uncategorized_count > 0 ? (
              <span className="text-xs text-muted-foreground">
                {ledger.summary.uncategorized_count} uncategorized
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Receipt drop-zone — the primary "log a cost" path (Henry chrome). */}
      <Link
        href="/expenses/import"
        className="flex items-center gap-4 rounded-xl border border-dashed border-brand/40 border-l-[3px] border-l-brand bg-brand/5 px-5 py-4 transition-colors hover:bg-brand/10"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-brand/20 bg-card text-brand">
          <Upload className="size-5" aria-hidden />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand">
            ✦ Henry · fastest path
          </span>
          <span className="font-medium text-foreground">
            Drop receipts here. Henry reads vendor, date, amount, and GST.
          </span>
          <span className="text-xs text-muted-foreground">
            Up to 50 at once · JPG, PNG, HEIC, PDF ·{' '}
            <Link href="/expenses/new" className="font-semibold text-foreground hover:underline">
              or log one manually
            </Link>
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-brand" aria-hidden />
      </Link>

      {isFirstRun ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-16 text-center">
          <p className="font-medium">Nothing here yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Drop a receipt — Henry fills the form — or log your first overhead expense manually.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/expenses/import">
                <Upload className="size-3.5" />
                Drop receipts
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/expenses/new">
                <Plus className="size-3.5" />
                Log expense
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ExpensesFilterBar
            periods={periods}
            activePeriodKey={activePeriod?.key ?? null}
            categories={pickerOptions}
            activeCategoryId={categoryId}
            vendors={ledger.facets.vendors}
            activeVendor={vendor}
            paymentSources={paymentSources}
            activeSourceId={sourceId}
            uncategorizedOnly={uncategorizedOnly}
            uncategorizedCount={ledger.summary.uncategorized_count}
            defaultQuery={search ?? ''}
          />

          {ledger.rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card py-14 text-center">
              <p className="font-medium">No expenses match those filters</p>
              <p className="text-sm text-muted-foreground">
                Try a wider date range, or clear a filter.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-1">
                <Link href="/expenses">Clear all filters</Link>
              </Button>
            </div>
          ) : (
            <ExpensesTable
              expenses={ledger.rows}
              categories={pickerOptions}
              paymentSources={paymentSources}
              shownOf={{ shown: ledger.rows.length, total: ledger.total }}
              footer={
                <ExpensesPager page={ledger.page} pageSize={ledger.pageSize} total={ledger.total} />
              }
            />
          )}
        </>
      )}

      <RecurringRulesCard rules={recurringRules} />
    </div>
  );
}
