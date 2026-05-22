/**
 * Read-only "crew on this job this week" slice for the project Schedule tab.
 *
 * Single-location principle: scheduling lives only on /calendar. This is a
 * display-only mirror of THIS project's dated `project_assignments` for the
 * next 7 days, with a deep-link into the by-worker calendar pivot. It never
 * edits the schedule — assigning/moving happens on /calendar.
 *
 * Self-hides (returns null) when the project has no scheduled crew days in
 * the window, so it adds no noise to jobs that aren't staffed yet.
 */

import Link from 'next/link';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { listAssignmentsForProject } from '@/lib/db/queries/project-assignments';
import { listWorkerProfiles } from '@/lib/db/queries/worker-profiles';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function isoInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
}

export async function ProjectCrewSlice({ projectId }: { projectId: string }) {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;
  // Crew/labour is owner/admin/member-internal — never homeowner. Workers
  // see their own days in /w. Gate to internal operator roles.
  if (tenant.member.role === 'worker') return null;

  const tz = tenant.timezone ?? 'America/Vancouver';
  const [assignments, workers] = await Promise.all([
    listAssignmentsForProject(tenant.id, projectId),
    listWorkerProfiles(tenant.id),
  ]);

  // 7-day window from today (tenant-local).
  const today = isoInTz(new Date(), tz);
  const windowEnd = (() => {
    const d = new Date(`${today}T00:00`);
    d.setDate(d.getDate() + 6);
    return isoInTz(d, tz);
  })();

  const dated = assignments.filter(
    (a) => a.scheduled_date && a.scheduled_date >= today && a.scheduled_date <= windowEnd,
  );
  if (dated.length === 0) return null;

  const nameById = new Map(workers.map((w) => [w.id, w.display_name ?? 'Worker']));

  // Group by worker → sorted unique scheduled dates in the window.
  const byWorker = new Map<string, string[]>();
  for (const a of dated) {
    if (!a.scheduled_date) continue;
    const arr = byWorker.get(a.worker_profile_id) ?? [];
    if (!arr.includes(a.scheduled_date)) arr.push(a.scheduled_date);
    byWorker.set(a.worker_profile_id, arr);
  }

  const rows = Array.from(byWorker.entries())
    .map(([wid, dates]) => ({
      name: nameById.get(wid) ?? 'Worker',
      dates: dates.sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const fmtChip = (iso: string) => {
    const d = new Date(`${iso}T00:00`);
    // Day-of-week label is tz-agnostic here (iso is already a tenant-local
    // date key); use UTC getters on the midnight-anchored date for the DOW.
    const dow = DAY_NAMES[new Date(`${iso}T12:00:00Z`).getUTCDay()];
    return `${dow} ${d.getUTCDate()}`;
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Crew this week</h3>
          <p className="text-xs text-muted-foreground">
            Scheduled days on this job — manage on the crew calendar.
          </p>
        </div>
        <Link
          href={`/calendar?view=by-worker&project=${projectId}`}
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          Open crew calendar →
        </Link>
      </div>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 py-2">
            <span className="truncate text-sm font-medium">{r.name}</span>
            <span className="flex flex-wrap justify-end gap-1">
              {r.dates.map((iso) => (
                <span
                  key={iso}
                  className="rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
                >
                  {fmtChip(iso)}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
