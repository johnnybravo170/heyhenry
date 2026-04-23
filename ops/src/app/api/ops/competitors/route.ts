import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const createSchema = z.object({
  actor_name: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().max(2000).optional().nullable(),
  edge_notes: z.string().trim().max(20000).optional().nullable(),
  latest_findings: z.record(z.string(), z.unknown()).optional().default({}),
  last_checked_at: z.string().datetime().optional().nullable(),
});

/**
 * POST /api/ops/competitors — upsert a competitor card by `name`.
 * Existing rows merge: url/edge_notes/latest_findings/last_checked_at are
 * replaced with whatever the agent sent; absent fields are left alone.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'write:competitors' });
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
  const row: Record<string, unknown> = {
    actor_type: 'agent',
    actor_name: parsed.data.actor_name,
    key_id: auth.key.id,
    name: parsed.data.name,
    latest_findings: parsed.data.latest_findings ?? {},
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.url !== undefined) row.url = parsed.data.url;
  if (parsed.data.edge_notes !== undefined) row.edge_notes = parsed.data.edge_notes;
  if (parsed.data.last_checked_at !== undefined) row.last_checked_at = parsed.data.last_checked_at;

  const { data, error } = await service
    .schema('ops')
    .from('competitors')
    .upsert(row, { onConflict: 'name' })
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
    url: `https://ops.heyhenry.io/competitors/${data.id}`,
  });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:competitors' });
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') ?? '100')));

  const service = createServiceClient();
  const { data, error } = await service
    .schema('ops')
    .from('competitors')
    .select(
      'id, name, url, edge_notes, latest_findings, last_checked_at, actor_type, actor_name, created_at, updated_at',
    )
    .order('updated_at', { ascending: false })
    .limit(limit);

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

  return NextResponse.json({ competitors: data ?? [] });
}
