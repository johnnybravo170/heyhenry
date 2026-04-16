/**
 * Admin Supabase client with the service-role key.
 *
 * WARNING: This client BYPASSES ROW LEVEL SECURITY. Every query runs with
 * full admin privileges across every tenant. Use ONLY from trusted
 * server-side code where tenant isolation is enforced manually (e.g.
 * backup scripts, Stripe webhook handlers, cron jobs).
 *
 * NEVER import this file into a client component, a Server Component that
 * renders based on user input, or any path that accepts unvalidated input.
 *
 * Prefer `./server.ts` for user-scoped server work.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
