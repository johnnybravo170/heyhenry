/**
 * Unit coverage for the schedule-slip "behind" predicate — the working-day
 * end-vs-today rule that feeds the digest, Gantt outline, Overview strip,
 * and tab badge. Pure (no DB), so it pins the math the four surfaces share.
 */

import { describe, expect, it } from 'vitest';
import { isTaskBehind } from '@/lib/db/queries/project-schedule-slip';

/** UTC-midnight Date for a YYYY-MM-DD, matching the slip-source convention. */
const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe('isTaskBehind', () => {
  // Wed 2026-05-20 → 3 working days = Wed, Thu, Fri = ends Fri 2026-05-22.
  const baseWorkingTask = {
    planned_start_date: '2026-05-20',
    planned_duration_days: 3,
    duration_basis: 'working' as const,
    works_weekends: false,
    status: 'planned' as const,
  };

  it('is behind when the working-day end is strictly before today', () => {
    // End = Fri May 22; today = Mon May 25 → behind.
    expect(isTaskBehind(baseWorkingTask, day('2026-05-25'))).toBe(true);
  });

  it('is NOT behind on the end day itself (end === today)', () => {
    // End = Fri May 22; today = Fri May 22 → still has the day, not behind.
    expect(isTaskBehind(baseWorkingTask, day('2026-05-22'))).toBe(false);
  });

  it('is NOT behind when the end is in the future', () => {
    expect(isTaskBehind(baseWorkingTask, day('2026-05-21'))).toBe(false);
  });

  it('is NEVER behind when status is done, even past due', () => {
    expect(isTaskBehind({ ...baseWorkingTask, status: 'done' }, day('2026-06-01'))).toBe(false);
  });

  it('counts in_progress past its end as behind (running long)', () => {
    expect(isTaskBehind({ ...baseWorkingTask, status: 'in_progress' }, day('2026-05-25'))).toBe(
      true,
    );
  });

  it('skips weekends for working-basis tasks — a passed weekend is not slip', () => {
    // Start Fri May 22, 1 working day → ends Fri May 22. On Sat May 23 the
    // end is in the past by calendar but the task only just finished Friday;
    // with working-day math today rolls to Mon May 25 conceptually, but the
    // predicate compares raw dates, so verify the weekend boundary directly:
    // a 2-working-day task starting Fri spans Fri + Mon (skips Sat/Sun).
    const fridayStart = {
      ...baseWorkingTask,
      planned_start_date: '2026-05-22',
      planned_duration_days: 2,
    };
    // End = Mon May 25. On Sun May 24 it's not yet behind.
    expect(isTaskBehind(fridayStart, day('2026-05-24'))).toBe(false);
    // On Tue May 26 (after the Monday end) it is behind.
    expect(isTaskBehind(fridayStart, day('2026-05-26'))).toBe(true);
  });

  it('honors calendar basis — weekends count toward the end', () => {
    // Calendar 3 days from Fri May 22 → Fri, Sat, Sun = ends Sun May 24.
    const calendarTask = {
      ...baseWorkingTask,
      planned_start_date: '2026-05-22',
      duration_basis: 'calendar' as const,
    };
    expect(isTaskBehind(calendarTask, day('2026-05-25'))).toBe(true);
    expect(isTaskBehind(calendarTask, day('2026-05-24'))).toBe(false);
  });

  it('works_weekends override counts straight through under working basis', () => {
    const weekendRunner = {
      ...baseWorkingTask,
      planned_start_date: '2026-05-22',
      planned_duration_days: 3,
      works_weekends: true,
    };
    // Fri + Sat + Sun = ends Sun May 24.
    expect(isTaskBehind(weekendRunner, day('2026-05-25'))).toBe(true);
    expect(isTaskBehind(weekendRunner, day('2026-05-24'))).toBe(false);
  });
});
