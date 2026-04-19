/**
 * GET /api/photos/ai-worker
 *
 * Photo AI classification worker endpoint. Hit every minute by the external
 * cron pinger (cron-job.org) with Authorization: Bearer ${CRON_SECRET}.
 *
 * Shares the CRON_SECRET with /api/ar/cron since they're both platform
 * dispatch endpoints owned by the same operator.
 */

import { runPhotoAiWorker } from '@/lib/photos/ai-worker';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runPhotoAiWorker();
  return Response.json({ ok: true, ...result });
}
