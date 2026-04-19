/**
 * GET /api/ar/cron
 *
 * Autoresponder dispatch tick. Invoked by the external cron pinger every
 * minute (Vercel Hobby plan blocks sub-daily native crons — see
 * AUTORESPONDER_PLAN.md).
 *
 * Does two things per tick:
 *   1. Drain the `ar_events` queue — enroll contacts into matching
 *      event-triggered sequences (closeout, etc.)
 *   2. Run due enrollments — dispatch the next step for each active,
 *      not-quiet-houred enrollment
 *
 * Events run first so newly-emitted events are eligible on the same tick.
 *
 * Auth: Bearer ${CRON_SECRET}. Shared with /api/photos/ai-worker.
 */

import { processArEvents } from '@/lib/ar/event-bus';
import { runDueEnrollments } from '@/lib/ar/executor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const events = await processArEvents();
  const dispatch = await runDueEnrollments();

  return Response.json({ ok: true, events, dispatch });
}
