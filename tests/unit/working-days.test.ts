import { describe, expect, it } from 'vitest';
import {
  addWorkingDays,
  isWeekend,
  workingDayEnd,
  workingDaysBetween,
} from '@/lib/date/working-days';

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('isWeekend', () => {
  it('flags Saturday and Sunday, not weekdays', () => {
    expect(isWeekend(utc('2026-03-28'))).toBe(true); // Sat
    expect(isWeekend(utc('2026-03-29'))).toBe(true); // Sun
    expect(isWeekend(utc('2026-03-30'))).toBe(false); // Mon
    expect(isWeekend(utc('2026-03-26'))).toBe(false); // Thu
  });

  it('accepts a raw 0-6 day index', () => {
    expect(isWeekend(0)).toBe(true);
    expect(isWeekend(6)).toBe(true);
    expect(isWeekend(3)).toBe(false);
  });
});

describe('addWorkingDays', () => {
  it('5 working days from a Thursday lands the following Thursday', () => {
    // Thu Mar 26 → Fri 27, (skip Sat/Sun) Mon 30, Tue 31, Wed Apr 1, Thu Apr 2
    expect(iso(addWorkingDays(utc('2026-03-26'), 5))).toBe('2026-04-02');
  });

  it('returns the same day for n = 0', () => {
    expect(iso(addWorkingDays(utc('2026-03-26'), 0))).toBe('2026-03-26');
  });

  it('skips the weekend when stepping over it', () => {
    // Fri Mar 27 + 1 working day → Mon Mar 30
    expect(iso(addWorkingDays(utc('2026-03-27'), 1))).toBe('2026-03-30');
  });

  it('rolls a weekend start forward to Monday on the first step', () => {
    // Sat Mar 28 + 1 working day → Mon Mar 30
    expect(iso(addWorkingDays(utc('2026-03-28'), 1))).toBe('2026-03-30');
  });

  it('steps backward through working days for negative n', () => {
    // Mon Mar 30 - 1 working day → Fri Mar 27
    expect(iso(addWorkingDays(utc('2026-03-30'), -1))).toBe('2026-03-27');
  });
});

describe('workingDaysBetween', () => {
  it('counts working-day steps, skipping weekends (lag in working days)', () => {
    // Thu Mar 26 → Wed Apr 1: Fri, Mon, Tue, Wed = 4 working days
    expect(workingDaysBetween(utc('2026-03-26'), utc('2026-04-01'))).toBe(4);
  });

  it('is 0 across a bare weekend with same working anchor', () => {
    // Fri Mar 27 → Sun Mar 29: no further working day reached
    expect(workingDaysBetween(utc('2026-03-27'), utc('2026-03-29'))).toBe(0);
  });

  it('is negative when to precedes from', () => {
    expect(workingDaysBetween(utc('2026-04-01'), utc('2026-03-26'))).toBe(-4);
  });
});

describe('workingDayEnd', () => {
  it('working basis: 5 working days from Thursday ends the following Wednesday', () => {
    // Thu Mar 26 inclusive + 4 more working days → Wed Apr 1
    expect(
      iso(workingDayEnd(utc('2026-03-26'), 5, { basis: 'working', worksWeekends: false })),
    ).toBe('2026-04-01');
  });

  it('calendar basis: 5 days from Thursday counts straight through the weekend', () => {
    // Thu Mar 26 + 4 calendar days → Mon Mar 30
    expect(
      iso(workingDayEnd(utc('2026-03-26'), 5, { basis: 'calendar', worksWeekends: false })),
    ).toBe('2026-03-30');
  });

  it('worksWeekends override counts calendar days even under working basis', () => {
    expect(
      iso(workingDayEnd(utc('2026-03-26'), 5, { basis: 'working', worksWeekends: true })),
    ).toBe('2026-03-30');
  });

  it('duration of 1 returns the start day', () => {
    expect(
      iso(workingDayEnd(utc('2026-03-26'), 1, { basis: 'working', worksWeekends: false })),
    ).toBe('2026-03-26');
  });
});
