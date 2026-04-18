import { PlatformMetrics } from '@/components/features/admin/platform-metrics';
import { getPlatformStats } from '@/lib/db/queries/admin';
import { getDailyTimeseries, getPlatformOverview } from '@/lib/db/queries/platform-metrics';

export default async function AdminOverviewPage() {
  const [stats, overview, signupsSeries, interactionsSeries, voiceSeries, smsSeries] =
    await Promise.all([
      getPlatformStats(),
      getPlatformOverview(),
      getDailyTimeseries(30, 'signups'),
      getDailyTimeseries(30, 'interactions'),
      getDailyTimeseries(30, 'voice_minutes'),
      getDailyTimeseries(30, 'sms'),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform overview</h1>
        <p className="text-sm text-muted-foreground">
          Every operator, every tenant, every Henry interaction — rolled up.
        </p>
      </div>

      <PlatformMetrics stats={stats} />

      <div className="grid gap-3 md:grid-cols-4">
        <TimeseriesKpi label="Signups (30d)" value={overview.signups30d} data={signupsSeries} />
        <TimeseriesKpi
          label="Interactions (30d)"
          value={overview.interactions30d}
          data={interactionsSeries}
        />
        <TimeseriesKpi
          label="Voice min (30d)"
          value={Math.round(overview.voiceMinutes30d)}
          data={voiceSeries}
        />
        <TimeseriesKpi label="SMS sent (30d)" value={overview.sms30d} data={smsSeries} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatBlock label="Active (7 days)" value={overview.activeTenants7d} />
        <StatBlock label="Active (30 days)" value={overview.activeTenants30d} />
        <StatBlock
          label="Avg interactions / active tenant"
          value={overview.avgInteractionsPerActiveTenant30d.toFixed(1)}
        />
      </div>
    </div>
  );
}

function TimeseriesKpi({
  label,
  value,
  data,
}: {
  label: string;
  value: number;
  data: Array<{ day: string; count: number }>;
}) {
  // Simple inline sparkline via SVG so we don't pull Recharts into this page
  // until B2. Width: 160, height: 28. Scaled to max of series.
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 160;
  const h = 28;
  const pts = data
    .map((d, i) => {
      const x = (i / Math.max(1, data.length - 1)) * w;
      const y = h - (d.count / max) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-2 h-7 w-full text-primary"
        role="img"
        aria-label={`${label} trend sparkline`}
      >
        <title>{`${label} trend`}</title>
        <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
      </svg>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
