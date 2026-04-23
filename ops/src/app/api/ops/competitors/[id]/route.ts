import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const patchSchema = z.object({
  url: z.string().trim().max(2000).nullable().optional(),
  edge_notes: z.string().trim().max(20000).nullable().optional(),
  latest_findings: z.record(z.string(), z.unknown()).optional(),
  last_checked_at: z.string().datetime().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:competitors' });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const service = createServiceClient();
  const { data: item } = await service
    .schema('ops')
    .from('competitors')
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
  const auth = await authenticateRequest(req, { requiredScope: 'write:competitors' });
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
  if (parsed.data.url !== undefined) patch.url = parsed.data.url;
  if (parsed.data.edge_notes !== undefined) patch.edge_notes = parsed.data.edge_notes;
  if (parsed.data.latest_findings !== undefined)
    patch.latest_findings = parsed.data.latest_findings;
  if (parsed.data.last_checked_at !== undefined)
    patch.last_checked_at = parsed.data.last_checked_at;

  const { error } = await service.schema('ops').from('competitors').update(patch).eq('id', id);
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
