// One-shot migration applier for 0122_project_phases.sql.
// Bypasses `supabase db push` which is blocked by historical
// duplicate-version-number conflicts in this repo.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sql = readFileSync(
  join(__dirname, '..', 'supabase', 'migrations', '0122_project_phases.sql'),
  'utf8',
);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(url, { prepare: false, max: 1 });
try {
  await client.unsafe(sql);
  console.log('Applied 0122_project_phases.sql');
} catch (e) {
  console.error('Migration failed:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
