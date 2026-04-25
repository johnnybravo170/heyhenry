/**
 * GET /api/cron/henry-nightly
 *
 * Daily Henry housekeeping. Two passes:
 *   1. Overdue tasks → write `henry_suggestion` notifications.
 *   2. Leads gone quiet 5+ days → write `henry_suggestion` notifications.
 *
 * Both passes are idempotent within a 24h window.
 *
 * Auth: Bearer ${CRON_SECRET}.
 *
 * Vercel cron entry: see vercel.json — runs at 13:00 UTC (~6 AM PDT).
 */

import { nightlyLeadUnansweredScan, nightlyOverdueScan } from '@/server/ai/triggers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const overdue = await nightlyOverdueScan();
  const leads = await nightlyLeadUnansweredScan();

  return Response.json({ ok: true, overdue, leads });
}
