import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const CHANNELS = ['blog', 'twitter', 'linkedin', 'youtube_short', 'reddit', 'other'] as const;
const STATUSES = ['draft', 'approved', 'posted', 'rejected'] as const;

const createSchema = z.object({
  actor_name: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(500),
  channel: z.enum(CHANNELS),
  draft_body: z.string().trim().min(1).max(50000),
  source_pain_points: z.array(z.unknown()).optional().default([]),
  status: z.enum(STATUSES).optional().default('draft'),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'write:social' });
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
    .from('social_drafts')
    .insert({
      actor_type: 'agent',
      actor_name: parsed.data.actor_name,
      key_id: auth.key.id,
      topic: parsed.data.topic,
      channel: parsed.data.channel,
      draft_body: parsed.data.draft_body,
      source_pain_points: parsed.data.source_pain_points,
      status: parsed.data.status,
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
    url: `https://ops.heyhenry.io/social-drafts/${data.id}`,
  });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:social' });
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const channel = url.searchParams.get('channel');
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') ?? '100')));

  const service = createServiceClient();
  let query = service
    .schema('ops')
    .from('social_drafts')
    .select(
      'id, topic, channel, draft_body, source_pain_points, status, posted_at, posted_url, actor_type, actor_name, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status) query = query.eq('status', status);
  if (channel) query = query.eq('channel', channel);

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

  return NextResponse.json({ social_drafts: data ?? [] });
}
