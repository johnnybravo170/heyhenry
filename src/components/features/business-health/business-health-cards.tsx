/**
 * Business Health cockpit hero + supporting KPI row. Server-renderable, pure
 * display — restyled to the OD render (`od-business-health/screens/desktop`):
 *
 *   - `BusinessHealthHero` — two hero cards: Net cash flow YTD (with a 6-month
 *     mini bar chart) + AR outstanding with aging bands (current / 1–30d /
 *     30d+). Tone via status-tokens-aligned ink/ok/danger; rust reserved for
 *     Henry/actions only (none here).
 *   - `BusinessHealthKpiRow` — three supporting tiles: Revenue YTD · AP
 *     outstanding · Owner pay YTD (salary/dividend/reimburse breakdown).
 *
 * Money renders CAD with de-emphasized cents via `<Money>`. Three type sizes
 * (16/14/12 + the hero display sizes) per the Paper scale. Card tone never
 * colour-only — the hero sub-line carries the label/glyph.
 */

import { ArrowRight, Info } from 'lucide-react';
import Link from 'next/link';
import { Money } from '@/components/ui/money';
import type { BusinessHealthCockpit } from '@/lib/db/queries/business-health-cockpit';
import type { BusinessHealthMetrics } from '@/lib/db/queries/business-health-metrics';

const DRAW_TYPE_LABELS: Record<string, string> = {
  salary: 'Salary',
  dividend: 'Dividend',
  reimbursement: 'Reimburse',
  other: 'Other',
};

/** Short month label in the tenant's tz (e.g. "May"). Explicit timeZone so
 *  the label never shifts on the UTC Vercel runtime. */
function monthLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { month: 'short', timeZone: timezone }).format(
    new Date(iso),
  );
}

// ---------------------------------------------------------------------------
// Hero — Net cash flow + AR aging
// ---------------------------------------------------------------------------

export function BusinessHealthHero({
  metrics,
  cockpit,
  timezone,
}: {
  metrics: BusinessHealthMetrics;
  cockpit: BusinessHealthCockpit;
  timezone: string;
}) {
  return (
    <section aria-label="Cockpit hero" className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1fr]">
      <NetCashCard metrics={metrics} cockpit={cockpit} timezone={timezone} />
      <ArAgingCard metrics={metrics} cockpit={cockpit} />
    </section>
  );
}

function HeroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function NetCashCard({
  metrics,
  cockpit,
  timezone,
}: {
  metrics: BusinessHealthMetrics;
  cockpit: BusinessHealthCockpit;
  timezone: string;
}) {
  const net = metrics.net_cash_flow_ytd_cents;
  const tone = net >= 0 ? 'text-emerald-700' : 'text-red-700';

  const series = cockpit.cash_series;
  const maxAbs = Math.max(1, ...series.map((p) => Math.abs(p.net_cents)));
  const currentMonth = series[series.length - 1]?.month;

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-card px-5 pt-4 pb-3.5">
      <div className="flex items-center gap-2">
        <HeroLabel>Net cash flow · YTD</HeroLabel>
        <span className="ml-auto font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Revenue − expenses − owner pay
        </span>
      </div>

      <div
        className={`flex items-baseline text-[40px] font-bold leading-[1.05] tracking-tight ${tone}`}
      >
        <Money cents={net} className={tone} />
      </div>

      <p className="text-xs text-muted-foreground">
        Fiscal year to date · <strong className="font-semibold text-foreground">tax-aware</strong>{' '}
        (incl. GST/HST on AR)
      </p>

      {/* 6-month mini bar chart. */}
      <div
        className="mt-1 grid grid-cols-6 gap-1.5"
        role="img"
        aria-label="Net cash by month, last 6 months"
      >
        {series.map((p) => {
          const pct = Math.round((Math.abs(p.net_cents) / maxAbs) * 100);
          const neg = p.net_cents < 0;
          const isCurrent = p.month === currentMonth;
          return (
            <div key={p.month} className="flex flex-col gap-1">
              <div
                className={`relative h-9 overflow-hidden rounded ${
                  isCurrent ? 'shadow-[inset_0_0_0_1.5px_var(--color-foreground)]' : ''
                } bg-muted`}
              >
                <div
                  className={`absolute inset-x-0 bottom-0 rounded-t ${neg ? 'bg-brand/90' : 'bg-emerald-600/85'}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span
                className={`text-center font-mono text-[10px] font-semibold uppercase tracking-wide ${
                  isCurrent ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {monthLabel(p.month, timezone)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArAgingCard({
  metrics,
  cockpit,
}: {
  metrics: BusinessHealthMetrics;
  cockpit: BusinessHealthCockpit;
}) {
  const ar = metrics.ar_outstanding;
  const aging = cockpit.ar_aging;
  const oldest = aging.oldest_age_days;
  const has30Plus = aging.late_30_plus.count > 0;

  const total = Math.max(1, ar.total_cents);
  const wCurrent = (aging.current.total_cents / total) * 100;
  const wLate30 = (aging.late_1_30.total_cents / total) * 100;
  const wLate60 = (aging.late_30_plus.total_cents / total) * 100;

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-card px-5 pt-4 pb-3.5">
      <div className="flex items-center gap-2">
        <HeroLabel>AR outstanding</HeroLabel>
        <Link
          href="/invoices?status=sent"
          className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          View invoices <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>

      <div
        className={`flex items-baseline text-[40px] font-bold leading-[1.05] tracking-tight ${
          has30Plus ? 'text-red-700' : 'text-foreground'
        }`}
      >
        <Money cents={ar.total_cents} className={has30Plus ? 'text-red-700' : 'text-foreground'} />
      </div>

      <p className="text-xs text-muted-foreground">
        {ar.count === 0 ? (
          'Nothing awaiting payment'
        ) : (
          <>
            <strong className="font-semibold text-foreground">
              {ar.count} invoice{ar.count === 1 ? '' : 's'}
            </strong>
            {oldest !== null ? (
              <>
                {' '}
                · oldest <strong className="font-semibold text-foreground">{oldest}d</strong>
              </>
            ) : null}{' '}
            · tax-aware (incl. GST/HST)
          </>
        )}
      </p>

      {ar.count > 0 ? (
        <div className="mt-1 flex flex-col gap-2">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full bg-blue-600" style={{ width: `${wCurrent}%` }} />
            <div className="h-full bg-amber-600" style={{ width: `${wLate30}%` }} />
            <div className="h-full bg-red-700" style={{ width: `${wLate60}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <AgingCell label="Current" dot="bg-blue-600" band={aging.current} note="0–30d" />
            <AgingCell label="1–30d late" dot="bg-amber-600" band={aging.late_1_30} />
            <AgingCell label="30d+ late" dot="bg-red-700" band={aging.late_30_plus} danger />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AgingCell({
  label,
  dot,
  band,
  note,
  danger,
}: {
  label: string;
  dot: string;
  band: { total_cents: number; count: number };
  note?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-r border-border pr-2 last:border-r-0 last:pr-0">
      <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span
        className={`text-sm font-semibold tabular-nums ${danger ? 'text-red-700' : 'text-foreground'}`}
      >
        <Money cents={band.total_cents} className={danger ? 'text-red-700' : 'text-foreground'} />
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {band.count} inv{note ? ` · ${note}` : ''}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supporting KPI row — Revenue · AP · Owner pay
// ---------------------------------------------------------------------------

export function BusinessHealthKpiRow({ metrics }: { metrics: BusinessHealthMetrics }) {
  return (
    <section aria-label="Supporting metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiTile
        label="Revenue · YTD"
        cents={metrics.revenue_ytd_cents}
        href="/invoices?status=paid"
        sub="Paid invoices · fiscal year to date"
      />
      <KpiTile
        label="AP outstanding"
        cents={metrics.ap_outstanding.total_cents}
        sub={
          metrics.ap_outstanding.count === 0
            ? 'No unpaid bills'
            : `${metrics.ap_outstanding.count} bill${metrics.ap_outstanding.count === 1 ? '' : 's'} pending`
        }
      />
      <KpiTile label="Owner pay · YTD" cents={metrics.owner_pay_ytd.total_cents}>
        <OwnerPayBreakdown byType={metrics.owner_pay_ytd.by_type} />
      </KpiTile>
    </section>
  );
}

function KpiTile({
  label,
  cents,
  href,
  sub,
  children,
}: {
  label: string;
  cents: number;
  href?: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
        <Money cents={cents} />
      </span>
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
      {children}
    </>
  );

  const className =
    'flex min-h-[100px] flex-col gap-1.5 rounded-[14px] border border-border bg-card px-[18px] py-3.5 text-left transition-colors';

  return href ? (
    <Link href={href} className={`${className} hover:bg-muted`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

function OwnerPayBreakdown({ byType }: { byType: Partial<Record<string, number>> }) {
  const entries = Object.entries(byType).filter(([, cents]) => (cents ?? 0) > 0);
  if (entries.length === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Info className="size-3" aria-hidden />
        No draws recorded yet this year
      </span>
    );
  }
  return (
    <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-1">
      {entries.map(([type, cents]) => (
        <span
          key={type}
          className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {DRAW_TYPE_LABELS[type] ?? type}{' '}
          <strong className="font-bold text-foreground">
            <Money cents={cents ?? 0} />
          </strong>
        </span>
      ))}
    </div>
  );
}
