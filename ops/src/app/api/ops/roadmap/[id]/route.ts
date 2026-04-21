import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, logAuditSuccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase';

const STATUSES = ['backlog', 'up_next', 'in_progress', 'done', 'archived'] as const;

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.number().int().min(1).max(5).nullable().optional(),
  assignee: z.string().trim().max(200).nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req, { requiredScope: 'read:roadmap' });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const service = createServiceClient();
  const { data: item } = await service
    .schema('ops')
    .from('roadmap_items')
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
  const auth = await authenticateRequest(req, { requiredScope: 'write:roadmap' });
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
    patch.status_changed_at = new Date().toISOString();
  }
  if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority;
  if (parsed.data.assignee !== undefined) patch.assignee = parsed.data.assignee;

  const { error } = await service.schema('ops').from('roadmap_items').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log each changed field.
  for (const [k, v] of Object.entries(parsed.data)) {
    await service
      .schema('ops')
      .from('roadmap_activity')
      .insert({
        item_id: id,
        actor_type: 'agent',
        actor_name: auth.key.name,
        kind:
          k === 'status' ? 'status_changed' : k === 'priority' ? 'priority_changed' : 'assigned',
        to_value: v == null ? null : String(v),
      });
  }

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
