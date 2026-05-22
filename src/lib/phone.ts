/**
 * Canonical phone-number handling — one place for normalize + format.
 *
 * Pure helpers, no server-only imports, so the validator, server actions,
 * client components, and tests all share the exact same logic.
 *
 * Two layers:
 *   - `phoneDigits()`   — bare significant digits (NANP country code stripped).
 *                         The matching key for dedup + search.
 *   - `normalizePhone()`— the canonical STORAGE form: E.164 (`+16045550820`)
 *                         for a valid 10-digit NANP number. Lenient: anything
 *                         it can't confidently parse is preserved (cleaned),
 *                         never dropped — real contractor data has extensions,
 *                         the odd international number, and outright garbage.
 *   - `formatPhone()`   — the DISPLAY form (`(604) 555-0820`). Falls back to
 *                         the stored value when it isn't a clean NANP number.
 *
 * Canada/NANP first (the ICP). International numbers keep their `+` country
 * code; un-parseable input is stored as its digits (or original) so search
 * still works and we never silently corrupt a contact.
 */

/**
 * Significant digits only. Strips formatting and a leading NANP `1`
 * (so `+1 604 555 0820`, `1-604-555-0820`, and `(604) 555-0820` all collapse
 * to `6045550820`). NULL-safe.
 */
export function phoneDigits(input: string | null | undefined): string {
  if (!input) return '';
  const digits = input.replace(/\D+/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

/**
 * Canonical storage form. Returns:
 *   - `+1XXXXXXXXXX` for a 10-digit NANP number (or 11-digit `1`-prefixed).
 *   - `+<digits>`    when the input already carries a `+` country code.
 *   - the bare digits when there are some but it isn't a clean NANP number.
 *   - `null`         for empty / no-digit input.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const allDigits = trimmed.replace(/\D+/g, '');
  if (!allDigits) return null;

  // Already international (kept verbatim apart from formatting noise).
  if (trimmed.startsWith('+')) {
    // NANP written as +1… still collapses to the canonical +1XXXXXXXXXX.
    if (allDigits.length === 11 && allDigits.startsWith('1')) return `+${allDigits}`;
    return `+${allDigits}`;
  }

  if (allDigits.length === 11 && allDigits.startsWith('1')) return `+${allDigits}`;
  if (allDigits.length === 10) return `+1${allDigits}`;

  // Not a confident NANP number (extension, short code, partial, junk).
  // Keep the digits so it's still searchable; don't fabricate a country code.
  return allDigits;
}

/**
 * Display form. `+16045550820` → `(604) 555-0820`. Anything that isn't a
 * clean 10-digit NANP number is returned as-stored (international numbers,
 * extensions, partials) so we never hide what's on file.
 */
export function formatPhone(stored: string | null | undefined): string {
  if (!stored) return '';
  const digits = phoneDigits(stored);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return stored;
}
