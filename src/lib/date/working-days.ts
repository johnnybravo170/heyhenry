/**
 * Working-day date core — skip-weekends arithmetic shared by the project
 * Schedule Gantt (`project-schedule.ts`, `schedule-gantt.tsx`) and the
 * crew Calendar (`owner-calendar.tsx`). Pure functions, unit-testable.
 *
 * "Working day" = Mon–Fri, excluding statutory holidays. Weekends (Sat/Sun)
 * always carry no work. Statutory holidays are optionally skipped when a
 * `ReadonlySet<string>` of ISO YYYY-MM-DD dates is passed — see `ca-holidays.ts`
 * for the Canadian provincial holiday lookup that builds those sets.
 *
 * Day-of-week is read via `getUTCDay()`, so callers must anchor Dates in
 * UTC midnight (`new Date('YYYY-MM-DDT00:00:00Z')`) for these to mean
 * "this calendar day" regardless of the runtime tz — the same convention
 * the Gantt already uses. The calendar component constructs runtime-local
 * Dates and only uses `isWeekend`, which it can satisfy via the
 * day-number overloads below.
 */

/** True for Saturday/Sunday. Accepts a Date (read in UTC) or a 0–6 day index. */
export function isWeekend(value: Date | number): boolean {
  const dow = typeof value === 'number' ? value : value.getUTCDay();
  return dow === 0 || dow === 6;
}

/** True when `date` is in the `holidays` set (ISO YYYY-MM-DD strings). */
export function isHoliday(date: Date, holidays: ReadonlySet<string>): boolean {
  return holidays.has(date.toISOString().slice(0, 10));
}

/** A day is non-working when it's a weekend OR a statutory holiday. */
function isNonWorking(d: Date, holidays?: ReadonlySet<string>): boolean {
  if (isWeekend(d)) return true;
  return Boolean(holidays && holidays.size > 0 && isHoliday(d, holidays));
}

function addUtcDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * Advance `start` by `n` working days, skipping weekends.
 *
 * Semantics: `n` is a count of working days to step forward from `start`.
 * `addWorkingDays(date, 0)` returns `start` unchanged. Each step lands on
 * the next Mon–Fri; if `start` itself is a weekend the first step rolls
 * to Monday. Negative `n` steps backward through working days.
 *
 * Used both for "end = start + (duration − 1) working days" (inclusive
 * last work day) and for "successor start = predecessor end + lag + 1
 * working day".
 */
export function addWorkingDays(start: Date, n: number, holidays?: ReadonlySet<string>): Date {
  if (n === 0) return new Date(start);
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  let cursor = new Date(start);
  while (remaining > 0) {
    cursor = addUtcDays(cursor, step);
    if (!isNonWorking(cursor, holidays)) remaining -= 1;
  }
  return cursor;
}

/**
 * Count of working days strictly between `from` and `to` — i.e. the
 * number of Mon–Fri steps needed to walk `from` forward to `to`. Returns
 * 0 when they're the same day or only weekends separate them. Negative
 * when `to` precedes `from`.
 */
export function workingDaysBetween(from: Date, to: Date, holidays?: ReadonlySet<string>): number {
  const a = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const b = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  if (a.getTime() === b.getTime()) return 0;
  const forward = b.getTime() > a.getTime();
  let cursor = forward ? a : b;
  const end = forward ? b : a;
  let count = 0;
  while (cursor.getTime() < end.getTime()) {
    cursor = addUtcDays(cursor, 1);
    if (!isNonWorking(cursor, holidays)) count += 1;
  }
  return forward ? count : -count;
}

/**
 * Inclusive end date for a task: the LAST day of work given a start and a
 * duration. `durationDays` of 1 → the start day itself.
 *
 * - basis 'calendar' OR worksWeekends: raw calendar arithmetic (existing
 *   rows and weekend-running tasks keep counting Sat/Sun).
 * - basis 'working' (default for new rows): the start day plus
 *   (duration − 1) further working days. A 'working' start that falls on
 *   a weekend is first rolled to the next working day so the bar begins
 *   where work actually begins.
 */
export function workingDayEnd(
  start: Date,
  durationDays: number,
  opts: { basis: 'working' | 'calendar'; worksWeekends: boolean; holidays?: ReadonlySet<string> },
): Date {
  const span = Math.max(1, durationDays) - 1;
  if (opts.basis === 'calendar' || opts.worksWeekends) {
    return addUtcDays(start, span);
  }
  const begin = isNonWorking(start, opts.holidays)
    ? addWorkingDays(start, 1, opts.holidays)
    : start;
  return addWorkingDays(begin, span, opts.holidays);
}
