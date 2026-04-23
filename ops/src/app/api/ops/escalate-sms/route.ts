/**
 * POST /api/ops/escalate-sms — send an SMS escalation to Jonathan.
 *
 * Required env (in addition to the standard ops envs):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_DEFAULT (or TWILIO_FROM_US)
 *   OPS_ESCALATION_PHONE — destination, E.164 (e.g. +15551234567).
 *     If unset, this endpoint returns 500.
 *
 * Body: { incident_id: uuid, message: string }
 * On success: marks incidents.sms_escalated_at = now(), returns the Twilio sid.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';
import { sendOpsSms } from '@/lib/twilio';

const bodySchema = z.object({
  incident_id: z.string().uuid(),
  message: z.string().trim().min(1).max(1500),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'write:escalate' });
  if (!auth.ok) return auth.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // Verify incident exists before paging Jonathan.
  const { data: incident } = await service
    .schema('ops')
    .from('incidents')
    .select('id')
    .eq('id', parsed.data.incident_id)
    .maybeSingle();
  if (!incident) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  }

  const result = await sendOpsSms(parsed.data.message);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  await service
    .schema('ops')
    .from('incidents')
    .update({ sms_escalated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', parsed.data.incident_id);

  const url = new URL(req.url);
  await logAuditSuccess(
    auth.key.id,
    'POST',
    url.pathname + url.search,
    200,
    auth.key.ip,
    req.headers.get('user-agent'),
    auth.bodySha,
    auth.reason,
  );

  return NextResponse.json({ ok: true, sid: result.sid });
}
