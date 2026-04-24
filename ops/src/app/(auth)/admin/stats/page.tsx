import { getStatsPageData } from '@/server/ops-services/git-stats';

export default async function StatsPage() {
  const data = await getStatsPageData();

  if (!data.hasData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Git activity</h1>
        <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
          No git stats yet. Run <code>scripts/git-stats-seed.mjs</code> from the repo root, then
          enable the daily Vercel cron at <code>/api/ops/git-stats/run</code>.
        </p>
      </div>
    );
  }

  const maxDay = Math.max(1, ...data.last30.map((d) => d.commit_count));
  const maxLoc = Math.max(1, ...data.weeklyLoc.map((w) => Math.max(w.added, w.deleted)));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Git activity</h1>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          All-time: {data.allTime.commits.toLocaleString()} commits · +
          {data.allTime.added.toLocaleString()} / -{data.allTime.deleted.toLocaleString()} LOC since{' '}
          {data.allTime.since}
        </p>
      </div>

      {/* Last 30 days bar chart */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Commits per day · last 30</h2>
        <div className="flex h-32 items-end gap-[2px] rounded-md border border-[var(--border)] p-3">
          {data.last30.map((d) => {
            const h = Math.round((d.commit_count / maxDay) * 100);
            return (
              <div
                key={d.day}
                title={`${d.day}: ${d.commit_count} commits`}
                className="flex-1 bg-[var(--foreground)] opacity-70"
                style={{ height: `${h}%`, minHeight: d.commit_count > 0 ? '2px' : '0' }}
              />
            );
          })}
        </div>
      </section>

      {/* Top contributors */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Top contributors · last 30 days</h2>
        {data.topContributorsThisMonth.length > 0 ? (
          <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
            {data.topContributorsThisMonth.map((c) => (
              <li key={c.name} className="flex items-baseline justify-between px-4 py-2 text-sm">
                <span>{c.name}</span>
                <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                  {c.commits} commits
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">No contributor data yet.</p>
        )}
      </section>

      {/* Weekly LOC */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">LOC added/deleted · last 12 weeks</h2>
        <div className="space-y-1 rounded-md border border-[var(--border)] p-3">
          {data.weeklyLoc.map((w) => {
            const addedPct = (w.added / maxLoc) * 100;
            const delPct = (w.deleted / maxLoc) * 100;
            return (
              <div key={w.weekStart} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 tabular-nums text-[var(--muted-foreground)]">
                  {w.weekStart}
                </span>
                <div className="flex flex-1 items-center gap-1">
                  <div className="h-2 flex-1">
                    <div
                      className="h-2 bg-emerald-500"
                      style={{ width: `${addedPct}%` }}
                      title={`+${w.added}`}
                    />
                  </div>
                  <span className="w-16 text-right tabular-nums text-emerald-600">+{w.added}</span>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <div className="h-2 flex-1">
                    <div
                      className="h-2 bg-red-500"
                      style={{ width: `${delPct}%` }}
                      title={`-${w.deleted}`}
                    />
                  </div>
                  <span className="w-16 text-right tabular-nums text-red-600">-{w.deleted}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Fun stats */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-[var(--border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Busiest day
          </div>
          {data.busiestDay ? (
            <div className="mt-1">
              <div className="text-2xl font-semibold tabular-nums">{data.busiestDay.commits}</div>
              <div className="text-xs text-[var(--muted-foreground)]">on {data.busiestDay.day}</div>
            </div>
          ) : (
            <div className="text-sm text-[var(--muted-foreground)]">—</div>
          )}
        </div>
        <div className="rounded-md border border-[var(--border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Longest streak
          </div>
          {data.longestStreak ? (
            <div className="mt-1">
              <div className="text-2xl font-semibold tabular-nums">
                {data.longestStreak.days} days
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {data.longestStreak.start} → {data.longestStreak.end}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--muted-foreground)]">—</div>
          )}
        </div>
      </section>
    </div>
  );
}
