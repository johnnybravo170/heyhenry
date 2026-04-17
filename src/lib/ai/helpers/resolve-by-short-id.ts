/**
 * Shared helper for resolving records by full UUID or short ID (first 8 chars).
 */

import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a record from a table by full UUID or short ID prefix.
 *
 * @param table   - Supabase table name (e.g. 'quotes', 'jobs', 'invoices')
 * @param idInput - Full UUID or first 8 characters
 * @param select  - Columns to select (default '*')
 * @returns The matched row or an error string.
 */
export async function resolveByShortId<T = Record<string, unknown>>(
  table: string,
  idInput: string,
  select = '*',
): Promise<T | string> {
  const supabase = await createClient();

  if (UUID_RE.test(idInput)) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq('id', idInput)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !data) return `${table.slice(0, -1)} not found with ID: ${idInput}`;
    return data as T;
  }

  // Short ID: match on the first 8 characters of the UUID
  const { data: matches, error } = await supabase
    .from(table)
    .select(select)
    .ilike('id', `${idInput}%`)
    .is('deleted_at', null)
    .limit(5);

  if (error) return `Search failed: ${error.message}`;

  if (!matches || matches.length === 0) {
    return `No ${table.slice(0, -1)} found matching ID: ${idInput}`;
  }

  if (matches.length === 1) {
    return matches[0] as T;
  }

  return `Multiple ${table} match "${idInput}". Be more specific or use the full UUID.`;
}
