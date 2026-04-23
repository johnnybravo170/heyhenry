import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const createSchema = z.object({
  actor_name: z.string().trim().min(1).max(200),
  commit_range: z.string().trim().min(1).max(200),
  module: z.string().trim().min(1).max(200),
  summary_md: z.string().trim().min(1).max(200000),
  file_paths: z.array(z.string().trim().min(1).max(1000)).max(500).optional().default([]),
});

/**
 * POST /api/ops/docs — upsert a generated doc by `commit_range`.
 * Re-running the doc generator on the same range overwrites the prior summary.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'write:docs' });
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
    .from('docs')
    .upsert(
      {
        actor_type: 'agent',
        actor_name: parsed.data.actor_name,
        key_id: auth.key.id,
        commit_range: parsed.data.commit_range,
        module: parsed.data.module,
        summary_md: parsed.data.summary_md,
        file_paths: parsed.data.file_paths,
      },
      { onConflict: 'commit_range' },
    )
    .select('id, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Upsert failed' }, { status: 500 });
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
    url: `https://ops.heyhenry.io/docs/${data.id}`,
  });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:docs' });
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const moduleFilter = url.searchParams.get('module');
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') ?? '100')));

  const service = createServiceClient();
  let query = service
    .schema('ops')
    .from('docs')
    .select('id, commit_range, module, summary_md, file_paths, actor_type, actor_name, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (moduleFilter) query = query.eq('module', moduleFilter);

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

  return NextResponse.json({ docs: data ?? [] });
}
