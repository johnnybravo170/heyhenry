import Link from 'next/link';
import { BarChart } from '@/components/charts/bar-chart';
import { ChartCard } from '@/components/charts/chart-card';
import { LineChart } from '@/components/charts/line-chart';
import {
  getHenryOverview,
  getInteractionsByVertical,
  getTopToolCalls,
} from '@/lib/db/queries/henry-analytics';
import { getDailyTimeseries } from '@/lib/db/queries/platform-metrics';

type Search = Promise<{ days?: string }>;

const VALID_WINDOWS = [7, 30, 90];

export default async function AdminHenryPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const parsed = Number.parseInt(params.days ?? '30', 10);
  const days = VALID_WINDOWS.includes(parsed) ? parsed : 30;

  const [overview, timeseries, topTools, byVertical] = await Promise.all([
    getHenryOverview(days),
    getDailyTimeseries(days, 'interactions'),
    getTopToolCalls(days, 15),
    getInteractionsByVertical(days),
  ]);

  const toolBars = topTools.map((t) => ({ label: t.tool_name, value: t.count }));
  const verticalBars = byVertical.map((v) => ({
    label: v.vertical ?? '(none)',
    value: v.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Henry analytics</h1>
          <p className="text-sm text-muted-foreground">
            Every voice + text interaction, every tool call, across every tenant.
          </p>
        </div>
        <WindowPicker current={days} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Total interactions" value={overview.total} />
        <Kpi label="Error rate" value={`${(overview.errorRate * 100).toFixed(1)}%`} />
        <Kpi label="Avg duration" value={`${(overview.avgDurationMs / 1000).toFixed(1)}s`} />
        <Kpi
          label="Tokens"
          value={`${formatK(overview.totalInputTokens + overview.totalOutputTokens)}`}
          sub={`${formatK(overview.totalCachedInputTokens)} cached`}
        />
      </div>

      <ChartCard title="Interactions per day" description={`Last ${days} days, America/Vancouver`}>
        <LineChart data={timeseries} />
      </ChartCard>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard title="Top tool calls" description={`Top ${toolBars.length} tools by volume`}>
          <BarChart data={toolBars} horizontal />
        </ChartCard>
        <ChartCard title="Interactions by vertical" description="All tenants combined">
          <BarChart data={verticalBars} horizontal />
        </ChartCard>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function WindowPicker({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5 text-sm">
      {VALID_WINDOWS.map((d) => (
        <Link
          key={d}
          href={`/admin/henry?days=${d}`}
          className={
            current === d
              ? 'rounded-md bg-muted px-3 py-1 font-medium text-foreground'
              : 'rounded-md px-3 py-1 text-muted-foreground hover:text-foreground'
          }
        >
          {d}d
        </Link>
      ))}
    </div>
  );
}

function formatK(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
