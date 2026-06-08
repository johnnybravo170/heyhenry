'use client';

/**
 * This-week operating digest — the "now" lens for the Schedule tab.
 *
 * A compact, one-line-per-item read of what matters this week: what's
 * active now, what starts this week, what finishes this week, and what's
 * behind. Computed entirely from the already-loaded tasks (no new query)
 * using working-day-aware ends, so the behind count agrees with the
 * shared `getScheduleSlip` source that feeds the Overview strip + tab
 * badge. On mobile this is the default view (the Gantt sits behind the
 * List/Timeline toggle).
 *
 * "Behind" here mirrors `isTaskBehind`: working-day end < today (tenant
 * tz) AND status ≠ done. Dates parse at UTC midnight; today is the
 * tenant-tz calendar day at UTC midnight, so the comparison is day-vs-day.
 */

import { AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/date/format';
import { workingDayEnd } from '@/lib/date/working-days';
import type { ProjectScheduleTask } from '@/lib/db/queries/project-schedule';
import { statusToneClass } from '@/lib/ui/status-tokens';

function parseUtc(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00Z`);
}

function inclusiveEnd(task: ProjectScheduleTask): Date {
  return workingDayEnd(parseUtc(task.planned_start_date), task.planned_duration_days, {
    basis: task.duration_basis === 'calendar' ? 'calendar' : 'working',
    worksWeekends: Boolean(task.works_weekends),
  });
}

/** Tenant-tz calendar day at UTC midnight, matching the slip source. */
function todayUtc(timezone: string): Date {
  const str = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parseUtc(str);
}

/** Monday-anchored start of the week containing `d` (UTC). */
function weekStart(d: Date): Date {
  const out = new Date(d);
  const dow = out.getUTCDay(); // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1; // days since Monday
  out.setUTCDate(out.getUTCDate() - back);
  return out;
}

export type WeekDigest = {
  behindIds: string[];
  active: ProjectScheduleTask[];
  starts: ProjectScheduleTask[];
  finishes: ProjectScheduleTask[];
  /** Whole-project finish date (latest inclusive end) as ISO, or null. */
  projectFinishIso: string | null;
};

/** Pure digest computation — exported so callers can reuse the behind set. */
export function computeWeekDigest(tasks: ProjectScheduleTask[], timezone: string): WeekDigest {
  const today = todayUtc(timezone);
  const start = weekStart(today);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6); // Sunday

  const behindIds: string[] = [];
  const active: ProjectScheduleTask[] = [];
  const starts: ProjectScheduleTask[] = [];
  const finishes: ProjectScheduleTask[] = [];
  let latestEnd: Date | null = null;

  for (const t of tasks) {
    const s = parseUtc(t.planned_start_date);
    const e = inclusiveEnd(t);
    if (!latestEnd || e.getTime() > latestEnd.getTime()) latestEnd = e;

    const done = t.status === 'done';
    if (!done && e.getTime() < today.getTime()) behindIds.push(t.id);

    // Active now = spans today (start ≤ today ≤ end), not done.
    if (!done && s.getTime() <= today.getTime() && e.getTime() >= today.getTime()) active.push(t);
    // Starts this week.
    if (s.getTime() >= start.getTime() && s.getTime() <= end.getTime()) starts.push(t);
    // Finishes this week.
    if (e.getTime() >= start.getTime() && e.getTime() <= end.getTime()) finishes.push(t);
  }

  return {
    behindIds,
    active,
    starts,
    finishes,
    projectFinishIso: latestEnd ? latestEnd.toISOString().slice(0, 10) : null,
  };
}

function GroupLine({
  label,
  tasks,
  behindSet,
}: {
  label: string;
  tasks: ProjectScheduleTask[];
  behindSet: Set<string>;
}) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {tasks.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="min-w-0 truncate text-foreground">
          {tasks.map((t, i) => (
            <span key={t.id}>
              {i > 0 ? <span className="mx-1.5 text-muted-foreground">·</span> : null}
              {behindSet.has(t.id) ? (
                <AlertTriangle
                  className="mr-0.5 inline size-3 -translate-y-px text-destructive"
                  aria-label="behind"
                />
              ) : null}
              {t.name}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export function ScheduleWeekDigest({
  digest,
  timezone,
  onJumpToBehind,
}: {
  digest: WeekDigest;
  timezone: string;
  /** Optional handler when the operator taps the behind pill. */
  onJumpToBehind?: () => void;
}) {
  const behindCount = digest.behindIds.length;
  const behindSet = new Set(digest.behindIds);
  const calm =
    behindCount === 0 &&
    digest.active.length === 0 &&
    digest.starts.length === 0 &&
    digest.finishes.length === 0;

  // Calm on-track state — nothing active/behind this week.
  if (calm) {
    return (
      <div className="rounded-lg border bg-card px-3 py-2.5 text-sm text-muted-foreground">
        On track
        {digest.projectFinishIso
          ? ` — finishes ${formatDate(`${digest.projectFinishIso}T00:00:00Z`, { timezone, style: 'medium' })}.`
          : '.'}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          This week
        </span>
        {behindCount > 0 ? (
          <button
            type="button"
            onClick={onJumpToBehind}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusToneClass.danger}`}
            aria-label={`${behindCount} ${behindCount === 1 ? 'task' : 'tasks'} behind`}
          >
            <AlertTriangle className="size-3" aria-hidden="true" />
            {behindCount} behind
          </button>
        ) : null}
      </div>
      <GroupLine label="Active" tasks={digest.active} behindSet={behindSet} />
      <GroupLine label="Starts" tasks={digest.starts} behindSet={behindSet} />
      <GroupLine label="Finishes" tasks={digest.finishes} behindSet={behindSet} />
    </div>
  );
}
