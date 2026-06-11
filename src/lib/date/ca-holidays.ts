/**
 * Canadian statutory holiday calendar for the project Gantt scheduler.
 *
 * Returns federal + province-specific statutory holidays for a given
 * province code and year. Province codes match the existing `ProvinceCode`
 * values in `src/lib/tax/provinces.ts` (AB, BC, MB, NB, NL, NS, NT, NU,
 * ON, PE, QC, SK, YT).
 *
 * Implementation is pure arithmetic — no external data sources. Holiday
 * rules are formula-driven via the Gaussian Easter algorithm and nth-weekday
 * helpers. Covers 2024–2031; revisit when 2032 approaches or rules change.
 *
 * Scope: provincially-mandated public holidays where most employees are
 * entitled to a paid day off. Construction-relevant (Heritage Day in AB,
 * Terry Fox Day in MB) are included even when limited to some sectors.
 */

export type CanadaHoliday = { date: string; name: string };

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Easter Sunday — Gregorian Anonymous (Gaussian) algorithm. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const raw = h + l - 7 * m + 114;
  return utc(year, Math.floor(raw / 31), (raw % 31) + 1);
}

/**
 * nth occurrence (1-indexed) of `weekday` (0=Sun…6=Sat) in the given
 * UTC year/month. E.g. nthWeekday(2024, 2, 1, 3) = 3rd Monday of Feb 2024.
 */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = utc(year, month, 1);
  const daysUntil = (weekday - first.getUTCDay() + 7) % 7;
  return addDays(first, daysUntil + (n - 1) * 7);
}

/** Last occurrence of `weekday` strictly before year/month/day. */
function lastWeekdayBefore(year: number, month: number, day: number, weekday: number): Date {
  let d = addDays(utc(year, month, day), -1);
  while (d.getUTCDay() !== weekday) d = addDays(d, -1);
  return d;
}

export function getCanadianHolidays(
  province: string | null | undefined,
  year: number,
): CanadaHoliday[] {
  const holidays: CanadaHoliday[] = [];
  const add = (d: Date, name: string) => holidays.push({ date: isoDate(d), name });

  const easter = easterSunday(year);

  // ── Federal holidays (all provinces) ─────────────────────────────────
  add(utc(year, 1, 1), "New Year's Day");
  add(addDays(easter, -2), 'Good Friday');
  add(lastWeekdayBefore(year, 5, 25, 1), 'Victoria Day');

  // Canada Day: Jul 1, observed Mon when it falls on Sun
  const canadaDay = utc(year, 7, 1);
  add(canadaDay.getUTCDay() === 0 ? addDays(canadaDay, 1) : canadaDay, 'Canada Day');

  add(nthWeekday(year, 9, 1, 1), 'Labour Day');
  add(nthWeekday(year, 10, 1, 2), 'Thanksgiving Day');
  add(utc(year, 11, 11), 'Remembrance Day');
  add(utc(year, 12, 25), 'Christmas Day');

  // ── Province-specific ─────────────────────────────────────────────────
  const prov = (province ?? '').toUpperCase();

  if (prov === 'BC') {
    add(nthWeekday(year, 2, 1, 3), 'Family Day');
    add(nthWeekday(year, 8, 1, 1), 'BC Day');
  }

  if (prov === 'AB') {
    add(nthWeekday(year, 2, 1, 3), 'Family Day');
    add(nthWeekday(year, 8, 1, 1), 'Heritage Day');
  }

  if (prov === 'ON') {
    add(nthWeekday(year, 2, 1, 3), 'Family Day');
    add(nthWeekday(year, 8, 1, 1), 'Civic Holiday');
    add(utc(year, 12, 26), 'Boxing Day');
  }

  if (prov === 'QC') {
    add(addDays(easter, 1), 'Easter Monday');
    add(utc(year, 6, 24), 'National Holiday');
    add(utc(year, 12, 26), 'Boxing Day');
  }

  if (prov === 'MB') {
    add(nthWeekday(year, 2, 1, 3), 'Louis Riel Day');
    add(nthWeekday(year, 8, 1, 1), 'Terry Fox Day');
  }

  if (prov === 'SK') {
    add(nthWeekday(year, 2, 1, 3), 'Family Day');
    add(nthWeekday(year, 8, 1, 1), 'Saskatchewan Day');
  }

  if (prov === 'NS') {
    add(nthWeekday(year, 2, 1, 3), 'Heritage Day');
    add(nthWeekday(year, 8, 1, 1), 'Natal Day');
  }

  if (prov === 'NB') {
    add(nthWeekday(year, 8, 1, 1), 'New Brunswick Day');
  }

  if (prov === 'PE') {
    add(nthWeekday(year, 2, 1, 3), 'Islander Day');
    add(nthWeekday(year, 8, 1, 1), 'Civic Holiday');
  }

  if (prov === 'NL') {
    add(addDays(easter, 1), 'Easter Monday');
    add(utc(year, 3, 17), "St. Patrick's Day");
    add(utc(year, 4, 23), "St. George's Day");
    add(utc(year, 6, 24), 'Discovery Day');
    // Jul 1 = Memorial Day in NL (replaces the federal Canada Day name)
    add(nthWeekday(year, 7, 3, 1), 'Regatta Day');
    add(utc(year, 7, 12), "Orangemen's Day");
  }

  if (prov === 'YT') {
    add(addDays(easter, 1), 'Easter Monday');
    add(nthWeekday(year, 8, 1, 3), 'Discovery Day');
  }

  if (prov === 'NT' || prov === 'NU') {
    add(addDays(easter, 1), 'Easter Monday');
    if (prov === 'NU') add(utc(year, 7, 9), 'Nunavut Day');
  }

  // Deduplicate by date (e.g. NL Jul 1 = Memorial Day + Canada Day share the date)
  const seen = new Set<string>();
  return holidays.filter((h) => {
    if (seen.has(h.date)) return false;
    seen.add(h.date);
    return true;
  });
}

/**
 * Build a Set of ISO date strings for all statutory holidays in the given
 * province across the requested years. Pass directly to the optional
 * `holidays` parameter of the working-day math functions.
 */
export function buildHolidaySet(
  province: string | null | undefined,
  years: Iterable<number>,
): Set<string> {
  const s = new Set<string>();
  for (const year of years) {
    for (const h of getCanadianHolidays(province, year)) {
      s.add(h.date);
    }
  }
  return s;
}
