/**
 * Seed ops.git_daily_stats from local git log for the last 120 days.
 *
 * Counts every commit on the current branch (no author/branch filter).
 * Run from the repo root. Idempotent — UPSERTs by day.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/git-stats-seed.mjs
 */
import { execSync } from 'node:child_process';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const DAYS = 120;

function fmtDay(d) {
  return d.toISOString().slice(0, 10);
}

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

const today = new Date();
today.setUTCHours(0, 0, 0, 0);

let inserted = 0;
let totalCommits = 0;
const perDay = [];

for (let i = 0; i < DAYS; i++) {
  const day = new Date(today);
  day.setUTCDate(day.getUTCDate() - i);
  const dayStr = fmtDay(day);
  const since = `${dayStr} 00:00`;
  const until = `${dayStr} 23:59`;

  // Use --numstat for accurate per-commit insertions/deletions, then sum.
  const log = run(
    `git log --since='${since}' --until='${until}' --no-merges --pretty=format:'__C__%H%n%an' --numstat`,
  );
  let commitCount = 0;
  let added = 0;
  let deleted = 0;
  const contributors = new Set();
  const lines = log.split('\n');
  let expectAuthor = false;
  for (const line of lines) {
    if (line.startsWith('__C__')) {
      commitCount += 1;
      expectAuthor = true;
      continue;
    }
    if (expectAuthor) {
      if (line.trim()) contributors.add(line.trim());
      expectAuthor = false;
      continue;
    }
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const a = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    if (!Number.isNaN(a)) added += a;
    if (!Number.isNaN(d)) deleted += d;
  }

  totalCommits += commitCount;
  perDay.push({ day: dayStr, commitCount });

  await sql`
    INSERT INTO ops.git_daily_stats
      (day, commit_count, loc_added, loc_deleted, contributors, last_refreshed)
    VALUES
      (${dayStr}, ${commitCount}, ${added}, ${deleted}, ${[...contributors]}, now())
    ON CONFLICT (day) DO UPDATE SET
      commit_count = EXCLUDED.commit_count,
      loc_added = EXCLUDED.loc_added,
      loc_deleted = EXCLUDED.loc_deleted,
      contributors = EXCLUDED.contributors,
      last_refreshed = now()
  `;
  inserted += 1;
}

const avgPerDay = totalCommits / DAYS;
console.log(`Upserted ${inserted} rows.`);
console.log(`Total commits (last ${DAYS}d): ${totalCommits}`);
console.log(`Avg/day: ${avgPerDay.toFixed(2)}`);

await sql.end();
