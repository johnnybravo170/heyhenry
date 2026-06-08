/**
 * One-time storage migration for the Home Record → Property Record rename.
 *
 * Copies existing artifacts from the OLD buckets
 *   home-record-pdfs / home-record-zips
 * into the NEW buckets
 *   property-record-pdfs / property-record-zips
 * preserving each object's path ({tenant}/{project}/{slug}.{ext}) so the
 * property_records.pdf_path / zip_path columns keep resolving once the code
 * switches to the new buckets.
 *
 * Buckets can't be renamed in place, so this is the "carry the objects over"
 * step. It's idempotent (upsert), so re-running is safe.
 *
 * ORDER:
 *   1. Apply 20260525163048_rename_home_record_to_property_record.sql
 *      (creates the new buckets + policies).
 *   2. Run this script.
 *   3. Deploy the code that points at the new buckets.
 *   4. After verifying object counts match, delete the old buckets.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-property-record-buckets.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PAIRS = [
  ['home-record-pdfs', 'property-record-pdfs'],
  ['home-record-zips', 'property-record-zips'],
];

const PAGE = 100;

/** Recursively collect every object path under a prefix (folders have id=null). */
async function listAll(bucket, prefix = '') {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null || entry.id === undefined) {
        out.push(...(await listAll(bucket, path))); // folder → recurse
      } else {
        out.push(path);
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

let totalCopied = 0;
let totalFailed = 0;
for (const [src, dst] of PAIRS) {
  let paths;
  try {
    paths = await listAll(src);
  } catch (e) {
    console.error(`[${src}] could not list (bucket may not exist): ${e.message}`);
    continue;
  }
  console.log(`[${src}] ${paths.length} object(s) → [${dst}]`);
  for (const path of paths) {
    const { data: blob, error: dlErr } = await supabase.storage.from(src).download(path);
    if (dlErr) {
      console.error(`  ✗ download ${path}: ${dlErr.message}`);
      totalFailed++;
      continue;
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(dst)
      .upload(path, buf, { upsert: true, contentType: blob.type || 'application/octet-stream' });
    if (upErr) {
      console.error(`  ✗ upload ${path}: ${upErr.message}`);
      totalFailed++;
      continue;
    }
    totalCopied++;
    console.log(`  ✓ ${path}`);
  }
}
console.log(`\nDone. Copied ${totalCopied} object(s), ${totalFailed} failure(s).`);
if (totalFailed > 0) process.exitCode = 1;
