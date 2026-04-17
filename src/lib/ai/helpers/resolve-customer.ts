/**
 * Shared helper for fuzzy customer resolution across AI tools.
 *
 * Accepts a customer name (fuzzy ILIKE match) or a UUID (direct lookup).
 * Returns the matched customer or an error string.
 */

import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResolvedCustomer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

/**
 * Resolve a customer by UUID or name.
 *
 * - If `nameOrId` looks like a UUID, queries by `id` directly.
 * - Otherwise, runs a case-insensitive ILIKE search on the `name` column.
 * - Returns the customer object on a unique match.
 * - Returns a descriptive error string on 0 or 2+ matches.
 */
export async function resolveCustomer(nameOrId: string): Promise<ResolvedCustomer | string> {
  const supabase = await createClient();

  if (UUID_RE.test(nameOrId)) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email, phone')
      .eq('id', nameOrId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !data) return `Customer not found with ID: ${nameOrId}`;
    return data as ResolvedCustomer;
  }

  // Fuzzy name search
  const { data: matches, error } = await supabase
    .from('customers')
    .select('id, name, email, phone')
    .ilike('name', `%${nameOrId}%`)
    .is('deleted_at', null)
    .limit(10);

  if (error) return `Customer search failed: ${error.message}`;

  if (!matches || matches.length === 0) {
    return `No customers found matching "${nameOrId}".`;
  }

  if (matches.length === 1) {
    return matches[0] as ResolvedCustomer;
  }

  const names = matches.map((m) => `${m.name} (${m.id.slice(0, 8)})`).join(', ');
  return `Multiple customers match "${nameOrId}". Did you mean: ${names}?`;
}
