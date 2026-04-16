/**
 * Server-side Supabase client for Next.js App Router (RSC, Server Actions,
 * Route Handlers).
 *
 * Reads/writes auth cookies via Next 16's async `cookies()` API so that token
 * refreshes are persisted back to the response. Enforces RLS — queries run
 * as the signed-in user.
 *
 * Cookie writes throw inside pure Server Components (no response to write
 * into). We swallow that specific error so this client can still be used for
 * reads in RSC; writes happen from Server Actions, Route Handlers, and
 * middleware, where cookie mutation is allowed.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars');
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — cookie mutation is a no-op here.
          // Middleware or a Server Action handles persistence on the next hop.
        }
      },
    },
  });
}
