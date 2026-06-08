/**
 * POST /api/ops/calls/ingest
 *
 * Tool-agnostic ingest for founding-member call transcripts (card 657092a5).
 * Whatever recorder Jonathan uses (Fathom/Granola/Otter) gets a thin adapter
 * that POSTs a normalized CallTranscript here; this route validates + routes it
 * (redact → knowledge doc → eval-candidate ideas → audit). See
 * ops-services/call-ingest.ts and docs/call-capture.md.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (same shared secret as the ops
 * crons — the adapter/webhook holds it). Not a cron, so no vercel-cron header.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { finishAgentRun, recordAgentRun } from '@/lib/agents';
import { type CallTranscript, ingestCall } from '@/server/ops-services/call-ingest';

export const maxDuration = 60;

function isValid(body: unknown): body is CallTranscript {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.source === 'string' &&
    typeof b.title === 'string' &&
    typeof b.occurred_at === 'string' &&
    typeof b.consent === 'boolean' &&
    Array.isArray(b.participants) &&
    Array.isArray(b.segments)
  );
}

export async function POST(req: NextRequest) {
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const expected = process.env.CRON_SECRET;
  if (!expected || bearer !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValid(body)) {
    return NextResponse.json(
      {
        error:
          'Bad payload — need { source, title, occurred_at, consent, participants[], segments[] }',
      },
      { status: 400 },
    );
  }

  const run = await recordAgentRun({ slug: 'call-ingest', trigger: 'webhook' }).catch(() => null);
  try {
    const result = await ingestCall(body);
    if (run) {
      await finishAgentRun(run.id, {
        outcome: result.ok ? (result.skipped ? 'skipped' : 'success') : 'failure',
        items_acted: result.eval_candidates ?? 0,
        summary: result.ok
          ? result.skipped
            ? `duplicate — skipped (${body.title})`
            : `ingested "${body.title}": doc=${result.knowledge_doc_id}, eval_candidates=${result.eval_candidates}`
          : `refused: ${result.error}`,
        payload: result,
      }).catch(() => undefined);
    }
    // A consent/validation refusal is a 422, not a 500 — the caller sent a
    // well-formed but non-ingestable transcript.
    if (!result.ok) return NextResponse.json(result, { status: 422 });
    return NextResponse.json(result);
  } catch (e) {
    if (run) {
      await finishAgentRun(run.id, {
        outcome: 'failure',
        error: e instanceof Error ? e.message : String(e),
      }).catch(() => undefined);
    }
    throw e;
  }
}
