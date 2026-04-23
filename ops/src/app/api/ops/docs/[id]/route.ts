import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const patchSchema = z.object({
  module: z.string().trim().min(1).max(200).optional(),
  summary_md: z.string().trim().min(1).max(200000).optional(),
  file_paths: z.array(z.string().trim().min(1).max(1000)).max(500).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:docs' });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const service = createServiceClient();
  const { data: item } = await service
    .schema('ops')
    .from('docs')
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
  const auth = await authenticateRequest(req, { requiredScope: 'write:docs' });
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
  const patch: Record<string, unknown> = {};
  if (parsed.data.module !== undefined) patch.module = parsed.data.module;
  if (parsed.data.summary_md !== undefined) patch.summary_md = parsed.data.summary_md;
  if (parsed.data.file_paths !== undefined) patch.file_paths = parsed.data.file_paths;

  const { error } = await service.schema('ops').from('docs').update(patch).eq('id', id);
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
