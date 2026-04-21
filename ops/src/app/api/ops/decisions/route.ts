import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const createSchema = z.object({
  actor_name: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  hypothesis: z.string().trim().min(1).max(20000),
  action: z.string().trim().max(20000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional().default([]),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'write:decisions' });
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
    .from('decisions')
    .insert({
      actor_type: 'agent',
      actor_name: parsed.data.actor_name,
      key_id: auth.key.id,
      title: parsed.data.title,
      hypothesis: parsed.data.hypothesis,
      action: parsed.data.action ?? null,
      tags: parsed.data.tags,
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
    url: `https://ops.heyhenry.io/decisions/${data.id}`,
  });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:decisions' });
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') ?? '100')));

  const service = createServiceClient();
  let query = service
    .schema('ops')
    .from('decisions')
    .select(
      'id, title, hypothesis, action, status, actor_type, actor_name, tags, created_at, updated_at',
    )
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
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

  return NextResponse.json({ decisions: data ?? [] });
}
