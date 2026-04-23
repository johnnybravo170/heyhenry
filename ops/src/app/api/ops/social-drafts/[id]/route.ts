import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const STATUSES = ['draft', 'approved', 'posted', 'rejected'] as const;

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  draft_body: z.string().trim().min(1).max(50000).optional(),
  posted_at: z.string().datetime().nullable().optional(),
  posted_url: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:social' });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const service = createServiceClient();
  const { data: item } = await service
    .schema('ops')
    .from('social_drafts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(req.url);
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

  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req, { requiredScope: 'write:social' });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
    if (parsed.data.status === 'posted' && parsed.data.posted_at === undefined) {
      patch.posted_at = new Date().toISOString();
    }
  }
  if (parsed.data.draft_body !== undefined) patch.draft_body = parsed.data.draft_body;
  if (parsed.data.posted_at !== undefined) patch.posted_at = parsed.data.posted_at;
  if (parsed.data.posted_url !== undefined) patch.posted_url = parsed.data.posted_url;

  const { error } = await service.schema('ops').from('social_drafts').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = new URL(req.url);
  await logAuditSuccess(
    auth.key.id,
    'PATCH',
    url.pathname + url.search,
    200,
    auth.key.ip,
    req.headers.get('user-agent'),
    auth.bodySha,
    auth.reason,
  );

  return NextResponse.json({ ok: true });
}
