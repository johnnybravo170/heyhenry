/**
 * GET /api/ar/cron
 *
 * Autoresponder dispatch loop. Invoked by Vercel Cron every minute (see
 * `vercel.json`). Claims up to N due enrollments and runs one step each.
 *
 * Auth: Vercel Cron requests carry an `Authorization: Bearer ${CRON_SECRET}`
 * header. We reject anything without a matching secret so this endpoint can't
 * be poked from the public internet.
 */

import { runDueEnrollments } from '@/lib/ar/executor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runDueEnrollments();
  return Response.json({ ok: true, ...result });
}
