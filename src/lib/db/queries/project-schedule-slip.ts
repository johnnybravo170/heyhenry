/**
 * Schedule slip — the single source of truth for "behind" tasks.
 *
 * A task is BEHIND when its working-day-aware planned end is before today
 * (in the tenant's timezone) AND it isn't marked done. This one function
 * feeds all four slip surfaces so the counts can't drift:
 *   1. the This-week digest behind count (`schedule-interactive.tsx`),
 *   2. the danger-soft outline on past-due Gantt bars,
 *   3. the Overview "Needs You" `schedule_slip` rule (`project-insights.ts`),
 *   4. the Schedule tab-label badge (`project-tab-alerts.ts`).
 *
 * "Working-day end" honors each task's `duration_basis` + `works_weekends`
 * via `workingDayEnd` — a Mon–Fri trade doesn't read as behind just because
 * a weekend passed. Dates are stored as `YYYY-MM-DD` and parsed at UTC
 * midnight (the Gantt's convention); "today" is the tenant-tz calendar day,
 * likewise anchored at UTC midnight, so the `<` comparison is a clean
 * day-vs-day test free of runtime-tz drift.
 */

import { getCurrentTenant } from '@/lib/auth/helpers';
import { workingDayEnd } from '@/lib/date/working-days';
import { createClient } from '@/lib/supabase/server';

/** Trimmed task shape the slip calc needs — a subset of ProjectScheduleTask. */
export type BehindTask = {
  id: string;
  name: string;
  planned_start_date: string;
  planned_duration_days: number;
  duration_basis: 'working' | 'calendar';
  works_weekends: boolean;
  /** Working-day-aware inclusive last work-day, as `YYYY-MM-DD`. */
  planned_end_date: string;
};

export type ScheduleSlip = {
  behindCount: number;
  behindTaskIds: string[];
  behindTasks: BehindTask[];
};

const EMPTY: ScheduleSlip = { behindCount: 0, behindTaskIds: [], behindTasks: [] };

/** Parse a `YYYY-MM-DD` date string at UTC midnight (Gantt convention). */
function parseUtcDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00Z`);
}

/** Today's tenant-tz calendar day as a `YYYY-MM-DD` string. */
function todayDateStr(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Pure slip predicate, exported for unit testing without a DB round-trip.
 * A task is behind when its working-day inclusive end is strictly before
 * `today` (both anchored at UTC midnight) and it isn't done.
 */
export function isTaskBehind(
  task: {
    planned_start_date: string;
    planned_duration_days: number;
    duration_basis?: 'working' | 'calendar' | null;
    works_weekends?: boolean | null;
    status: string;
  },
  todayDate: Date,
): boolean {
  if (task.status === 'done') return false;
  const end = workingDayEnd(parseUtcDate(task.planned_start_date), task.planned_duration_days, {
    basis: (task.duration_basis ?? 'working') === 'calendar' ? 'calendar' : 'working',
    worksWeekends: Boolean(task.works_weekends),
  });
  return end.getTime() < todayDate.getTime();
}

/**
 * Compute the project's behind set. Resolves the tenant timezone for the
 * "today" boundary; pass `timezone` to skip the lookup when the caller
 * already has it (e.g. a server component that resolved the tenant).
 *
 * RLS scopes the read to the operator's tenant. Never throws an empty
 * result on its own — callers wrap it in their own `safe`/`safeCount`.
 */
export async function getScheduleSlip(projectId: string, timezone?: string): Promise<ScheduleSlip> {
  const tz = timezone ?? (await getCurrentTenant())?.timezone ?? 'America/Vancouver';
  const supabase = await createClient();

  const { data } = await supabase
    .from('project_schedule_tasks')
    .select(
      'id, name, planned_start_date, planned_duration_days, duration_basis, works_weekends, status',
    )
    .eq('project_id', projectId)
    .is('deleted_at', null);

  if (!data || data.length === 0) return EMPTY;

  const today = parseUtcDate(todayDateStr(tz));

  const behindTasks: BehindTask[] = [];
  for (const row of data) {
    const r = row as Record<string, unknown>;
    const task = {
      planned_start_date: r.planned_start_date as string,
      planned_duration_days: (r.planned_duration_days as number) ?? 1,
      duration_basis: ((r.duration_basis as string) ?? 'working') as 'working' | 'calendar',
      works_weekends: Boolean(r.works_weekends),
      status: (r.status as string) ?? 'planned',
    };
    if (!isTaskBehind(task, today)) continue;
    const end = workingDayEnd(parseUtcDate(task.planned_start_date), task.planned_duration_days, {
      basis: task.duration_basis === 'calendar' ? 'calendar' : 'working',
      worksWeekends: task.works_weekends,
    });
    behindTasks.push({
      id: r.id as string,
      name: r.name as string,
      planned_start_date: task.planned_start_date,
      planned_duration_days: task.planned_duration_days,
      duration_basis: task.duration_basis,
      works_weekends: task.works_weekends,
      planned_end_date: end.toISOString().slice(0, 10),
    });
  }

  return {
    behindCount: behindTasks.length,
    behindTaskIds: behindTasks.map((t) => t.id),
    behindTasks,
  };
}
