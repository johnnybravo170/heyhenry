/**
 * Drizzle Kit configuration.
 *
 * We use Supabase CLI migrations (`supabase/migrations/`) as the source of
 * truth for what gets applied to the database. Drizzle Kit is only used for
 * generating migration files from schema changes during development — the
 * generated SQL is then hand-reviewed and copied into `supabase/migrations/`
 * with a conventional number prefix.
 *
 * Do NOT run `drizzle-kit push` against the remote DB. Use
 * `pnpm exec supabase db push` instead (see `package.json` → `db:push`).
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  // Drizzle Kit introspects the public schema only; `auth.*` is Supabase-managed.
  schemaFilter: ['public'],
  verbose: true,
  strict: true,
});
