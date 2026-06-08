import { ArrowRight, CheckSquare, Info, Upload } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BusinessHealthAttentionStrip } from '@/components/features/business-health/attention-strip';
import {
  BusinessHealthHero,
  BusinessHealthKpiRow,
} from '@/components/features/business-health/business-health-cards';
import { OwnerDrawsPanel } from '@/components/features/business-health/owner-draws-panel';
import { Button } from '@/components/ui/button';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { formatDate } from '@/lib/date/format';
import { getBusinessHealthAttention } from '@/lib/db/queries/business-health-attention';
import { getBusinessHealthCockpit } from '@/lib/db/queries/business-health-cockpit';
import {
  type BusinessHealthMetrics,
  getBusinessHealthMetrics,
} from '@/lib/db/queries/business-health-metrics';
import { listOwnerDrawsAction } from '@/server/actions/owner-draws';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Business Health',
};

export default async function BusinessHealthPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/login');

  const timezone = tenant.timezone;
  const year = new Date().getFullYear();

  // The headline metrics RPC + cockpit detail can each throw; degrade to a
  // calm retry card rather than crashing the route. Draws + the rest of the
  // chrome stay up even if one money source is unavailable.
  let metrics: BusinessHealthMetrics | null = null;
  let cockpit: Awaited<ReturnType<typeof getBusinessHealthCockpit>> | null = null;
  try {
    [metrics, cockpit] = await Promise.all([
      getBusinessHealthMetrics(year),
      getBusinessHealthCockpit(),
    ]);
  } catch {
    metrics = null;
    cockpit = null;
  }

  const drawsResult = await listOwnerDrawsAction({ year });
  const draws = drawsResult.ok ? drawsResult.rows : [];

  const attention = cockpit ? getBusinessHealthAttention(cockpit) : [];

  const fyLabel = metrics
    ? `FY ${metrics.year} · ${formatDate(metrics.fy_start, { timezone, style: 'medium' })} – ${formatDate(
        metrics.fy_end,
        { timezone, style: 'medium' },
      )}`
    : `FY ${year}`;

  return (
    <div className="flex flex-col gap-[18px]">
      {/* ── Page header ── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-baseline gap-3 text-2xl font-bold tracking-tight sm:text-[28px]">
            Business Health
            <span className="-translate-y-0.5 rounded-md bg-muted px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {fyLabel}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where your business stands this year — revenue in, money out, owner pay.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/business-health/bank-review">
              <CheckSquare className="size-4" />
              <span className="ml-1">Review matches</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/business-health/bank-import">
              <Upload className="size-4" />
              <span className="ml-1">Import bank statement</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* ── Henry attention strip — hidden when nothing's pressing ── */}
      <BusinessHealthAttentionStrip items={attention} />

      {/* ── Cockpit hero + supporting KPIs (or a calm retry card) ── */}
      {metrics && cockpit ? (
        <>
          <BusinessHealthHero metrics={metrics} cockpit={cockpit} timezone={timezone} />
          <BusinessHealthKpiRow metrics={metrics} />
        </>
      ) : (
        <section className="rounded-[14px] border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Couldn't load your numbers.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong fetching your money snapshot. Refresh to try again.
          </p>
        </section>
      )}

      {/* ── Owner draws ledger ── */}
      <OwnerDrawsPanel initialRows={draws} year={year} />

      {/* ── QBO handoff aside — operational view vs book of record ── */}
      <aside
        aria-label="How this fits with your bookkeeping"
        className="grid grid-cols-1 gap-4 rounded-[14px] border border-border bg-muted/40 px-5 py-4 sm:grid-cols-[22px_1fr_1fr]"
      >
        <span className="grid size-[22px] place-items-center rounded-md bg-card text-muted-foreground">
          <Info className="size-3" aria-hidden />
        </span>
        <div>
          <h4 className="text-sm font-bold tracking-tight text-foreground">
            How this fits with your bookkeeping
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Business Health is your{' '}
            <strong className="font-semibold text-foreground">operational view</strong> — fast
            snapshots so you can see where you stand today. Your books still live in QuickBooks (or
            wherever your bookkeeper works); HeyHenry pushes clean transactions over so they see the
            right data without re-entering anything.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Tip: instead of clicking{' '}
            <strong className="font-semibold text-foreground">mark paid</strong> on every invoice,
            drop your monthly bank statement into{' '}
            <Link
              href="/business-health/bank-import"
              className="inline-flex items-center gap-1 border-b border-border font-semibold text-foreground hover:border-foreground"
            >
              Import bank statement <ArrowRight className="size-3" aria-hidden />
            </Link>{' '}
            — Henry finds your unpaid invoices and expenses inside it and you confirm them in one
            go.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-[34px_1fr] items-start gap-2 text-sm text-foreground">
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-center font-mono text-[11px] font-bold uppercase leading-tight tracking-wide text-emerald-800">
              Is
            </span>
            <span>
              A <strong className="font-semibold">payment shortcut</strong> — mark a month of
              invoices &amp; bills paid from one statement.
            </span>
          </div>
          <div className="grid grid-cols-[34px_1fr] items-start gap-2 text-sm text-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 text-center font-mono text-[11px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
              Isn't
            </span>
            <span>
              <strong className="font-semibold">Bank reconciliation.</strong> Your bookkeeper still
              does that inside QuickBooks — the book of record.
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
