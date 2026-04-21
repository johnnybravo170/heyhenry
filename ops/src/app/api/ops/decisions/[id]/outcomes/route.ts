import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const outcomeSchema = z.object({
  actor_name: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  metrics: z.record(z.string(), z.unknown()).optional().default({}),
  conclude: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req, { requiredScope: 'write:decisions' });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = outcomeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('decision_outcomes')
    .insert({
      decision_id: id,
      actor_type: 'agent',
      actor_name: parsed.data.actor_name,
      body: parsed.data.body,
      metrics: parsed.data.metrics,
      concluded_at: parsed.data.conclude ? new Date().toISOString() : null,
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (parsed.data.conclude) {
    const { data: cur } = await service
      .schema('ops')
      .from('decisions')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    if (cur && ['open', 'measuring'].includes(cur.status as string)) {
      await service
        .schema('ops')
        .from('decisions')
        .update({ status: 'learned', updated_at: new Date().toISOString() })
        .eq('id', id);
    }
  }

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

  return NextResponse.json({ ok: true });
}
