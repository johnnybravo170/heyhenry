/**
 * Seed the Message Lab archetype panel from a vertical's dossier markdown.
 * Idempotent (upserts on knowledge slug + archetype slug). Re-run to refresh.
 *
 *   pnpm tsx scripts/seed-archetypes.ts [path-to-md] [vertical]
 *
 * Defaults: scripts/archetypes/gc-canada.md, vertical 'general_contractor'.
 *
 * Each `## Archetype N — Name` block becomes one knowledge_doc (the full
 * ~1,400-word dossier body) + one ops.archetypes row referencing it. The
 * attractiveness rank is parsed from the ranking table at the bottom.
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}
const svc = createClient(url, key, { auth: { persistSession: false } });

const FILE = process.argv[2] ?? 'scripts/archetypes/gc-canada.md';
const VERTICAL = process.argv[3] ?? 'general_contractor';

// Optional per-name emoji. Falls back to a hard-hat for anything unmapped.
const EMOJI: Record<string, string> = {
  'The Growing Systems Seeker': '📈',
  'The Burned-by-Software Skeptic': '🔥',
  'The Paper-and-Phone Holdout': '📒',
  'The Spouse-Run Back Office': '🧾',
  'The Too-Busy-to-Post Silent Majority': '🏃',
  'The Craft-First Reputation Builder': '🪚',
  'The Price-Squeezed Survivalist': '💸',
  'The Crew-Control Foreman-Owner': '👷',
  'The Software-Forward Optimizer': '⚙️',
  'The Service-Work Hybrid GC': '🔧',
};

type Parsed = {
  slug: string;
  name: string;
  tagline: string;
  evidence_basis: 'observed' | 'inferred' | 'mixed';
  confidence: string;
  prevalence_note: string;
  body: string;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normEvidence(raw: string): Parsed['evidence_basis'] {
  const r = raw.toLowerCase();
  const hasObs = r.includes('observed');
  const hasInf = r.includes('inferred');
  if (hasObs && hasInf) return 'mixed';
  if (hasInf) return 'inferred';
  return 'observed';
}

function parseArchetypes(md: string): Parsed[] {
  // Split into blocks starting at each "## Archetype N — Name" header.
  const headerRe = /^## Archetype \d+ — (.+)$/gm;
  const matches = [...md.matchAll(headerRe)];
  const out: Parsed[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const name = m[1].trim();
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? md.length) : md.length;
    let block = md.slice(start, end).trim();
    // Trim a trailing "---" separator if present.
    block = block.replace(/\n+---\s*$/, '').trim();

    const tagline = block.match(/\*\*Tagline:\*\*\s*[“"]?(.+?)[”"]?\s*$/m)?.[1]?.trim() ?? '';
    const evidenceRaw = block.match(/\*\*evidence_basis:\*\*\s*(.+)$/m)?.[1]?.trim() ?? 'observed';
    const confidence = block.match(/\*\*confidence:\*\*\s*(.+)$/m)?.[1]?.trim() ?? 'medium';
    const prevalence = block.match(/Estimated\s+\*\*([^*]+)\*\*/)?.[1]?.trim() ?? '';

    out.push({
      slug: slugify(name),
      name,
      tagline,
      evidence_basis: normEvidence(evidenceRaw),
      confidence,
      prevalence_note: prevalence,
      body: block,
    });
  }
  return out;
}

function parseRanking(md: string): Map<string, number> {
  const ranks = new Map<string, number>();
  const tableRe = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|/gm;
  for (const m of md.matchAll(tableRe)) {
    const rank = Number.parseInt(m[1], 10);
    const name = m[2].trim();
    if (!Number.isNaN(rank) && name) ranks.set(name, rank);
  }
  return ranks;
}

async function main(): Promise<void> {
  const md = readFileSync(FILE, 'utf8');
  const archetypes = parseArchetypes(md);
  const ranks = parseRanking(md);
  if (archetypes.length === 0) {
    console.error(`No archetypes parsed from ${FILE} — check the "## Archetype N — Name" headers.`);
    process.exit(1);
  }
  console.log(`Seeding ${archetypes.length} archetypes (vertical=${VERTICAL}) into ${url}...`);

  // Upsert dossiers as knowledge_docs.
  const docRows = archetypes.map((a) => ({
    slug: `archetype-${VERTICAL}-${a.slug}`,
    title: `Archetype — ${a.name}`,
    tags: ['archetype', VERTICAL, a.evidence_basis],
    body: a.body,
    actor_type: 'system' as const,
    actor_name: 'seed-archetypes.ts',
    updated_at: new Date().toISOString(),
  }));
  const { data: docs, error: docErr } = await svc
    .schema('ops')
    .from('knowledge_docs')
    .upsert(docRows, { onConflict: 'slug' })
    .select('id, slug');
  if (docErr) {
    console.error('knowledge_docs upsert failed:', docErr);
    process.exit(1);
  }
  const slugToDocId = new Map<string, string>();
  for (const d of docs ?? []) slugToDocId.set(d.slug, d.id);
  console.log(`  ✓ ${docs?.length ?? 0} dossiers upserted`);

  // Upsert archetype rows. sort_order follows attractiveness rank when known.
  const rows = archetypes.map((a, i) => {
    const rank = ranks.get(a.name) ?? null;
    return {
      slug: `${VERTICAL}-${a.slug}`,
      vertical: VERTICAL,
      name: a.name,
      tagline: a.tagline,
      emoji: EMOJI[a.name] ?? '🧱',
      evidence_basis: a.evidence_basis,
      confidence: a.confidence,
      prevalence_note: a.prevalence_note,
      attractiveness_rank: rank,
      knowledge_id: slugToDocId.get(`archetype-${VERTICAL}-${a.slug}`) ?? null,
      status: 'active' as const,
      sort_order: rank ?? i + 1,
    };
  });
  const { data: seeded, error: archErr } = await svc
    .schema('ops')
    .from('archetypes')
    .upsert(rows, { onConflict: 'slug' })
    .select('slug, name, attractiveness_rank');
  if (archErr) {
    console.error('archetypes upsert failed:', archErr);
    process.exit(1);
  }
  console.log(`  ✓ ${seeded?.length ?? 0} archetypes upserted`);
  for (const a of (seeded ?? []).sort(
    (x, y) => (x.attractiveness_rank ?? 99) - (y.attractiveness_rank ?? 99),
  )) {
    console.log(`    #${a.attractiveness_rank ?? '?'} ${a.name} (${a.slug})`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
