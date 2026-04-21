'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/ops-gate';
import { createServiceClient } from '@/lib/supabase';

export type ActionResult = { ok: true } | { ok: false; error: string };

const VALID_STATUS = ['backlog', 'up_next', 'in_progress', 'done'];

async function logActivity(
  service: ReturnType<typeof createServiceClient>,
  itemId: string,
  actorName: string,
  kind: string,
  fromValue: string | null,
  toValue: string | null,
  note: string | null = null,
) {
  await service.schema('ops').from('roadmap_activity').insert({
    item_id: itemId,
    actor_type: 'human',
    actor_name: actorName,
    kind,
    from_value: fromValue,
    to_value: toValue,
    note,
  });
}

export async function setRoadmapItemStatusAction(
  id: string,
  status: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!VALID_STATUS.includes(status)) return { ok: false, error: 'Invalid status.' };
  const service = createServiceClient();

  const { data: cur } = await service
    .schema('ops')
    .from('roadmap_items')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  const prev = (cur?.status as string) ?? null;

  const { error } = await service
    .schema('ops')
    .from('roadmap_items')
    .update({
      status,
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  if (prev !== status) {
    await logActivity(service, id, admin.email, 'status_changed', prev, status);
  }

  revalidatePath(`/roadmap/${id}`);
  revalidatePath('/roadmap');
  return { ok: true };
}

export async function setRoadmapItemPriorityAction(
  id: string,
  priority: number | null,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (priority !== null && (priority < 1 || priority > 5)) {
    return { ok: false, error: 'Priority must be 1–5.' };
  }
  const service = createServiceClient();

  const { data: cur } = await service
    .schema('ops')
    .from('roadmap_items')
    .select('priority')
    .eq('id', id)
    .maybeSingle();
  const prev = cur?.priority == null ? null : String(cur.priority);

  const { error } = await service
    .schema('ops')
    .from('roadmap_items')
    .update({ priority, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  await logActivity(
    service,
    id,
    admin.email,
    'priority_changed',
    prev,
    priority == null ? null : String(priority),
  );

  revalidatePath(`/roadmap/${id}`);
  revalidatePath('/roadmap');
  return { ok: true };
}

export async function assignRoadmapItemAction(
  id: string,
  assignee: string | null,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const service = createServiceClient();

  const { data: cur } = await service
    .schema('ops')
    .from('roadmap_items')
    .select('assignee')
    .eq('id', id)
    .maybeSingle();
  const prev = (cur?.assignee as string | null) ?? null;

  const { error } = await service
    .schema('ops')
    .from('roadmap_items')
    .update({ assignee, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  await logActivity(service, id, admin.email, 'assigned', prev, assignee);

  revalidatePath(`/roadmap/${id}`);
  return { ok: true };
}

export async function archiveRoadmapItemAction(id: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!reason.trim()) return { ok: false, error: 'Reason required.' };
  const service = createServiceClient();

  const { error } = await service
    .schema('ops')
    .from('roadmap_items')
    .update({
      status: 'archived',
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  await logActivity(service, id, admin.email, 'status_changed', null, 'archived', reason.trim());

  revalidatePath('/roadmap');
  return { ok: true };
}

export async function addRoadmapCommentAction(itemId: string, body: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!body.trim()) return { ok: false, error: 'Comment required.' };
  const service = createServiceClient();
  const { error } = await service.schema('ops').from('roadmap_comments').insert({
    item_id: itemId,
    actor_type: 'human',
    actor_name: admin.email,
    admin_user_id: admin.userId,
    body: body.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/roadmap/${itemId}`);
  return { ok: true };
}
