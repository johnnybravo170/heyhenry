'use client';

/**
 * Henry slip prompt — the second embedded-Henry touchpoint. For each
 * task that's running behind (working-day end < today, status ≠ done —
 * the shared `isTaskBehind` predicate, surfaced here via the digest's
 * behind set), Henry offers a one-tap fix inline:
 *
 *   "✦ Drywall was due to finish Apr 1 and isn't marked done — running
 *    behind?"  [Bump 1 day]  [Mark done]
 *
 * Bump 1 day pushes planned_start by one working day via the existing
 * updateScheduleTaskAction (the cascade ripples downstream as usual);
 * Mark done flips status. Rust ✦ + left-border chrome, caution-soft fill
 * (a slip is information, not an error). Pairs with the slip detection
 * already shipped (digest count, Gantt outline, Overview strip, tab badge).
 */

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/date/format';
import { addWorkingDays, workingDayEnd } from '@/lib/date/working-days';
import type { ProjectScheduleTask } from '@/lib/db/queries/project-schedule';
import { statusToneClass } from '@/lib/ui/status-tokens';

function parseUtc(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00Z`);
}

/** Working-day-aware inclusive end, matching the slip source. */
function inclusiveEndIso(task: ProjectScheduleTask): string {
  return workingDayEnd(parseUtc(task.planned_start_date), task.planned_duration_days, {
    basis: task.duration_basis === 'calendar' ? 'calendar' : 'working',
    worksWeekends: Boolean(task.works_weekends),
  })
    .toISOString()
    .slice(0, 10);
}

/** Next working-day start for a +1 bump (skips weekends). */
export function bumpedStartIso(task: ProjectScheduleTask): string {
  return addWorkingDays(parseUtc(task.planned_start_date), 1).toISOString().slice(0, 10);
}

export function ScheduleSlipPrompt({
  behindTasks,
  timezone,
  onBump,
  onMarkDone,
}: {
  /** The behind set (already filtered to status ≠ done & past-due). */
  behindTasks: ProjectScheduleTask[];
  timezone: string;
  /** Push planned_start by 1 working day (cascades downstream). */
  onBump: (taskId: string) => void;
  /** Flip status → done. */
  onMarkDone: (taskId: string) => void;
}) {
  if (behindTasks.length === 0) return null;

  return (
    <div className={`rounded-r-lg border border-l-2 border-l-brand p-3 ${statusToneClass.warning}`}>
      <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-brand">
        <Sparkles className="size-3" aria-hidden />
        Henry
      </div>
      <ul className="space-y-2">
        {behindTasks.map((task) => (
          <li
            key={task.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm text-foreground"
          >
            <span className="min-w-0 leading-snug">
              <span className="font-medium">{task.name}</span> was due to finish{' '}
              {formatDate(`${inclusiveEndIso(task)}T00:00:00Z`, { timezone, style: 'medium' })} and
              isn&rsquo;t marked done — running behind?
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-background"
                onClick={() => onBump(task.id)}
              >
                Bump 1 day
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-background"
                onClick={() => onMarkDone(task.id)}
              >
                Mark done
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
