/**
 * Drizzle client factory.
 *
 * Usage:
 *   import { getDb } from '@/lib/db/client';
 *   const db = getDb();
 *   const rows = await db.select().from(tenants);
 *
 * This client talks directly to Postgres via the `postgres` driver (i.e. it
 * bypasses PostgREST and Supabase client SDKs). It's meant for:
 *   - Server-side queries where you want full SQL / joins
 *   - Integration tests and scripts
 *   - Backup / export jobs
 *
 * It does NOT carry a user JWT, so RLS treats it based on whatever role the
 * connection string's user has. For the `postgres` superuser URL, that means
 * RLS is effectively bypassed — treat this like the admin client.
 *
 * For user-scoped reads from Next.js RSC, prefer
 * `src/lib/supabase/server.ts` which carries the auth cookie.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Module-level singleton so we don't open a new pool on every import.
let _db: Db | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

export function getDb(): Db {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.local.example to .env.local and fill it in ' +
        '(Supabase dashboard > Settings > Database > Connection string).',
    );
  }

  _sql = postgres(url, {
    // Supabase pooler works fine with the defaults; keep this small for local/test.
    max: 4,
    prepare: false,
  });
  _db = drizzle(_sql, { schema });
  return _db;
}

/**
 * Close the pool. Call this from test teardown so Vitest can exit cleanly.
 */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
    _db = null;
  }
}

export * from './schema';
