import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const STATUSES = ['open', 'triaging', 'resolved', 'wontfix'] as const;

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  assigned_agent: z.string().trim().max(200).nullable().optional(),
  resolved_at: z.string().datetime().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:incidents' });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const service = createServiceClient();
  const { data: item } = await service
    .schema('ops')
    .from('incidents')
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
  const auth = await authenticateRequest(req, { requiredScope: 'write:incidents' });
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
    // Auto-stamp resolved_at if moving to resolved/wontfix and caller didn't.
    if (
      (parsed.data.status === 'resolved' || parsed.data.status === 'wontfix') &&
      parsed.data.resolved_at === undefined
    ) {
      patch.resolved_at = new Date().toISOString();
    }
  }
  if (parsed.data.assigned_agent !== undefined) patch.assigned_agent = parsed.data.assigned_agent;
  if (parsed.data.resolved_at !== undefined) patch.resolved_at = parsed.data.resolved_at;

  const { error } = await service.schema('ops').from('incidents').update(patch).eq('id', id);
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
