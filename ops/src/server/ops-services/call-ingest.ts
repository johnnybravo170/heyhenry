/**
 * Founding-member call ingest — the tool-agnostic ROUTE half of the capture
 * pipeline (card 657092a5).
 *
 * Recording + transcription + diarization are done by whatever tool Jonathan
 * uses (Fathom / Granola / Otter / …). This module takes the NORMALIZED
 * transcript those tools can all be adapted to (see CallTranscript), and:
 *   1. enforces consent (PIPEDA — reject if not explicitly captured),
 *   2. redacts PII (client names/phones/emails/addresses; keeps operator +
 *      contractor speaker names — they're the voices we learn from),
 *   3. stores the redacted transcript as a searchable knowledge doc
 *      (tagged customer-call + henry-behavioral — Henry + agents read it),
 *   4. extracts "Henry got X wrong" moments into `eval-candidate` ideas that
 *      feed the Henry eval suite (evals/henry),
 *   5. writes a worklog audit entry naming the sinks written.
 *
 * DEFERRED (no live consumer yet): a dedicated behavioral corpus and the
 * activation-watchdog queue. The watchdog (card 8b47758f) isn't built; adding
 * those sinks is a one-liner here once it is. Don't build sinks nothing reads.
 *
 * Whichever recorder is picked needs only a thin adapter that emits a
 * CallTranscript — the contract below is the stable seam.
 */

import { contentHash, embedText } from '@/lib/embed';
import { createServiceClient } from '@/lib/supabase';

export type CallSpeakerRole = 'operator' | 'contractor' | 'client' | 'homeowner' | 'other';

export type CallSegment = {
  speaker: string;
  role?: CallSpeakerRole;
  ts_seconds?: number;
  text: string;
};

export type CallTranscript = {
  /** Recording tool that produced this, freeform: 'fathom' | 'granola' | … */
  source: string;
  /** Human title, e.g. "Onboarding — Mike (Abbotsford GC)". */
  title: string;
  /** ISO timestamp of the call. */
  occurred_at: string;
  /** Explicit consent captured at the START of the call (PIPEDA). */
  consent: boolean;
  participants: { name: string; role: CallSpeakerRole }[];
  segments: CallSegment[];
};

export type IngestResult = {
  ok: boolean;
  knowledge_doc_id?: string;
  eval_candidates?: number;
  skipped?: 'duplicate';
  error?: string;
};

// Operator-side corrections that flag "Henry got it wrong" — the highest-value
// eval-candidate signal. Matched only on operator/contractor turns.
const CORRECTION_RE =
  /\b(no,? wait|that'?s not what i (asked|meant|said)|go back|actually,? no|that'?s wrong|not right|that'?s not right|undo that|cancel that|that'?s incorrect|wrong one)\b/i;

const PHONE_RE = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const POSTAL_RE = /\b[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/g;
const ADDRESS_RE =
  /\b\d{1,6}\s+[A-Za-z0-9.\s]{2,40}\b(street|st|ave|avenue|road|rd|drive|dr|lane|ln|blvd|boulevard|way|court|ct|crescent|cres|place|pl)\b\.?/gi;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Redact PII. Conservative — over-redaction beats leaking a client's details
 * into a corpus an agent reads. Client/homeowner participant names are redacted
 * by name (full + each token ≥3 chars); operator/contractor names are kept.
 */
export function redact(text: string, clientNames: string[]): string {
  let out = text
    .replace(ADDRESS_RE, '[address]')
    .replace(EMAIL_RE, '[email]')
    .replace(POSTAL_RE, '[postal]')
    .replace(PHONE_RE, '[phone]');

  const tokens = new Set<string>();
  for (const name of clientNames) {
    const trimmed = name.trim();
    if (trimmed) tokens.add(trimmed);
    for (const part of trimmed.split(/\s+/)) {
      if (part.length >= 3) tokens.add(part);
    }
  }
  // Longest-first so "Dave Park" is redacted before "Dave".
  for (const tok of [...tokens].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`\\b${escapeRe(tok)}\\b`, 'gi'), '[client]');
  }
  return out;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export async function ingestCall(t: CallTranscript): Promise<IngestResult> {
  if (!t.consent) {
    return {
      ok: false,
      error: 'consent=false — refusing to ingest (PIPEDA requires explicit consent)',
    };
  }
  if (!t.segments?.length) {
    return { ok: false, error: 'no segments' };
  }

  const service = createServiceClient();
  const clientNames = t.participants
    .filter((p) => p.role === 'client' || p.role === 'homeowner')
    .map((p) => p.name);

  // Dedup marker: one ingest per (date, first participant).
  const dateOnly = t.occurred_at.slice(0, 10);
  const dedupTag = `call:${dateOnly}:${slug(t.participants[0]?.name ?? t.source)}`;
  const { data: existing } = await service
    .schema('ops')
    .from('knowledge_docs')
    .select('id')
    .contains('tags', [dedupTag])
    .maybeSingle();
  if (existing) return { ok: true, skipped: 'duplicate', knowledge_doc_id: existing.id as string };

  // ── Build the redacted transcript markdown ──────────────────────────────
  const header = [
    `# ${t.title}`,
    '',
    `- Source: ${t.source}`,
    `- Date: ${dateOnly}`,
    `- Consent: captured at call start (${t.consent})`,
    `- Participants: ${t.participants.map((p) => `${p.role}`).join(', ')}`,
    '',
    '---',
    '',
  ].join('\n');
  const bodyLines = t.segments.map((s) => {
    const role = s.role ?? 'other';
    const speakerLabel =
      role === 'client' || role === 'homeowner' ? '[client]' : `${s.speaker} (${role})`;
    return `**${speakerLabel}:** ${redact(s.text, clientNames)}`;
  });
  const body = header + bodyLines.join('\n\n');

  // ── Sink 1+2: searchable knowledge doc (dual-tagged) ────────────────────
  const { data: doc, error: docErr } = await service
    .schema('ops')
    .from('knowledge_docs')
    .insert({
      actor_type: 'system',
      actor_name: 'call-ingest',
      title: t.title,
      body,
      tags: ['customer-call', 'henry-behavioral', dedupTag],
    })
    .select('id, title, body')
    .single();
  if (docErr || !doc)
    return { ok: false, error: docErr?.message ?? 'knowledge_docs insert failed' };

  // Embed so knowledge_search can find it. Best-effort: a failed embed leaves
  // the doc stored-but-unsearchable rather than losing it.
  try {
    const text = `${doc.title}\n\n${doc.body}`;
    const [vector, hash] = await Promise.all([embedText(text), contentHash(text)]);
    await service
      .schema('ops')
      .from('knowledge_embeddings')
      .insert({ doc_id: doc.id, embedding: vector, content_hash: hash });
    await service
      .schema('ops')
      .from('knowledge_docs')
      .update({ embedding_updated_at: new Date().toISOString() })
      .eq('id', doc.id);
  } catch (e) {
    console.error('[call-ingest] embedding failed (doc stored, not searchable):', e);
  }

  // ── Sink 3: "Henry got X wrong" → eval-candidate ideas ──────────────────
  let evalCandidates = 0;
  for (let i = 0; i < t.segments.length; i++) {
    const seg = t.segments[i];
    const role = seg.role ?? 'other';
    if (role !== 'operator' && role !== 'contractor') continue;
    const m = seg.text.match(CORRECTION_RE);
    if (!m) continue;

    // Context: the correction turn + up to 2 preceding turns (likely Henry's
    // action that prompted it), redacted.
    const ctx = t.segments
      .slice(Math.max(0, i - 2), i + 1)
      .map((s) => `**${s.role ?? 'other'}:** ${redact(s.text, clientNames)}`)
      .join('\n');
    const ideaBody = [
      `Possible Henry tool-call miss flagged from a real call ("${m[0]}").`,
      '',
      `From: ${t.title} (${dateOnly})`,
      '',
      '## Context',
      ctx,
      '',
      '## Next step',
      'Review and, if real, author an eval scenario in `evals/henry/scenarios.ts` (expected tool + args).',
    ].join('\n');
    const { error: ideaErr } = await service
      .schema('ops')
      .from('ideas')
      .insert({
        actor_type: 'system',
        actor_name: 'call-ingest',
        title: `Eval candidate: "${m[0]}" — ${t.title}`.slice(0, 200),
        body: ideaBody,
        tags: ['eval-candidate', 'henry', 'call-capture'],
      });
    if (!ideaErr) evalCandidates += 1;
  }

  // ── Audit ───────────────────────────────────────────────────────────────
  await service
    .schema('ops')
    .from('worklog_entries')
    .insert({
      actor_type: 'system',
      actor_name: 'call-ingest',
      title: `Ingested call: ${t.title}`,
      body: `Sinks: knowledge_doc=${doc.id}; eval_candidates=${evalCandidates}. Source=${t.source}.`,
      category: 'call-capture',
      site: 'heyhenry',
      tags: ['call-capture', 'audit'],
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return { ok: true, knowledge_doc_id: doc.id as string, eval_candidates: evalCandidates };
}
