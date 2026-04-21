import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const LANES = ['product', 'marketing', 'ops', 'sales', 'research'] as const;
const STATUSES = ['backlog', 'up_next', 'in_progress', 'done'] as const;

const createSchema = z.object({
  actor_name: z.string().trim().min(1).max(200),
  lane: z.enum(LANES),
  status: z.enum(STATUSES).optional().default('backlog'),
  priority: z.number().int().min(1).max(5).optional().nullable(),
  title: z.string().trim().min(1).max(500),
  body: z.string().trim().max(20000).optional().nullable(),
  assignee: z.string().trim().max(200).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional().default([]),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'write:roadmap' });
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
    .from('roadmap_items')
    .insert({
      actor_type: 'agent',
      actor_name: parsed.data.actor_name,
      key_id: auth.key.id,
      lane: parsed.data.lane,
      status: parsed.data.status,
      priority: parsed.data.priority ?? null,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      assignee: parsed.data.assignee ?? null,
      tags: parsed.data.tags,
    })
    .select('id, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  }

  await service.schema('ops').from('roadmap_activity').insert({
    item_id: data.id,
    actor_type: 'agent',
    actor_name: parsed.data.actor_name,
    kind: 'created',
    to_value: parsed.data.lane,
  });

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
    url: `https://ops.heyhenry.io/roadmap/${data.id}`,
  });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:roadmap' });
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const lane = url.searchParams.get('lane');
  const status = url.searchParams.get('status');
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') ?? '100')));

  const service = createServiceClient();
  let query = service
    .schema('ops')
    .from('roadmap_items')
    .select(
      'id, lane, status, priority, title, body, assignee, tags, actor_type, actor_name, source_idea_id, created_at, status_changed_at',
    )
    .neq('status', 'archived')
    .order('status_changed_at', { ascending: false })
    .limit(limit);
  if (lane) query = query.eq('lane', lane);
  if (status) query = query.eq('status', status);

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

  return NextResponse.json({ items: data ?? [] });
}
