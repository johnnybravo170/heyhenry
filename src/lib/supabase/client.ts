/**
 * Browser-side Supabase client.
 *
 * Use in Client Components. Reads the public URL + anon key from env.
 * Enforces RLS — every query runs as the signed-in user.
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars');
  }

  return createBrowserClient(url, anonKey);
}
