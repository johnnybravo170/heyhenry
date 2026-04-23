import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const SOURCES = ['app_error', 'qa_failure', 'security_probe', 'customer_pulse', 'other'] as const;
const SEVERITIES = ['low', 'med', 'high', 'critical'] as const;
const STATUSES = ['open', 'triaging', 'resolved', 'wontfix'] as const;

const createSchema = z.object({
  actor_name: z.string().trim().min(1).max(200),
  source: z.enum(SOURCES),
  severity: z.enum(SEVERITIES),
  status: z.enum(STATUSES).optional().default('open'),
  title: z.string().trim().min(1).max(500),
  body: z.string().trim().max(50000).optional().nullable(),
  assigned_agent: z.string().trim().max(200).optional().nullable(),
  context: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'write:incidents' });
  if (!auth.ok) return auth.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data, error } = await service
    .schema('ops')
    .from('incidents')
    .insert({
      actor_type: 'agent',
      actor_name: parsed.data.actor_name,
      key_id: auth.key.id,
      source: parsed.data.source,
      severity: parsed.data.severity,
      status: parsed.data.status,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      assigned_agent: parsed.data.assigned_agent ?? null,
      context: parsed.data.context ?? {},
    })
    .select('id, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
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

  return NextResponse.json({
    ok: true,
    id: data.id,
    created_at: data.created_at,
    url: `https://ops.heyhenry.io/incidents/${data.id}`,
  });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:incidents' });
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const severity = url.searchParams.get('severity');
  const source = url.searchParams.get('source');
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') ?? '100')));

  const service = createServiceClient();
  let query = service
    .schema('ops')
    .from('incidents')
    .select(
      'id, source, severity, status, title, body, assigned_agent, context, resolved_at, sms_escalated_at, actor_type, actor_name, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status) query = query.eq('status', status);
  if (severity) query = query.eq('severity', severity);
  if (source) query = query.eq('source', source);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAuditSuccess(
    auth.key.id,
    'GET',
    url.pathname + url.search,
    200,
    auth.key.ip,
    req.headers.get('user-agent'),
    auth.bodySha,
    auth.reason,
  );

  return NextResponse.json({ incidents: data ?? [] });
}
