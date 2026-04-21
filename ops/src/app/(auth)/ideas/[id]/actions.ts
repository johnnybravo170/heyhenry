'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/ops-gate';
import { createServiceClient } from '@/lib/supabase';

export type ActionResult = { ok: true } | { ok: false; error: string };

const VALID_STATUS = ['new', 'reviewed', 'in_progress', 'done', 'rejected'];

export async function setIdeaStatusAction(id: string, status: string): Promise<ActionResult> {
  await requireAdmin();
  if (!VALID_STATUS.includes(status)) return { ok: false, error: 'Invalid status.' };
  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('ideas')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ideas/${id}`);
  revalidatePath('/ideas');
  return { ok: true };
}

export async function rateIdeaAction(id: string, rating: number | null): Promise<ActionResult> {
  await requireAdmin();
  if (rating !== null && (rating < 1 || rating > 5)) {
    return { ok: false, error: 'Rating must be 1–5.' };
  }
  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('ideas')
    .update({ rating, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ideas/${id}`);
  revalidatePath('/ideas');
  return { ok: true };
}

export async function assignIdeaAction(id: string, assignee: string | null): Promise<ActionResult> {
  await requireAdmin();
  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('ideas')
    .update({ assignee, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ideas/${id}`);
  return { ok: true };
}

export async function addIdeaCommentAction(ideaId: string, body: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!body.trim()) return { ok: false, error: 'Comment body required.' };
  const service = createServiceClient();
  const { error } = await service.schema('ops').from('idea_comments').insert({
    idea_id: ideaId,
    actor_type: 'human',
    actor_name: admin.email,
    admin_user_id: admin.userId,
    body: body.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ideas/${ideaId}`);
  return { ok: true };
}

export async function queueFollowupAction(
  ideaId: string,
  kind: 'promote_to_roadmap' | 'assign' | 'generic_followup',
  payload: Record<string, unknown>,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const service = createServiceClient();
  const { error } = await service.schema('ops').from('idea_followups').insert({
    idea_id: ideaId,
    kind,
    payload,
    requested_by: admin.userId,
  });
  if (error) return { ok: false, error: error.message };

  // Also drop a system comment on the idea so the timeline shows the request.
  await service
    .schema('ops')
    .from('idea_comments')
    .insert({
      idea_id: ideaId,
      actor_type: 'system',
      actor_name: 'ops',
      admin_user_id: admin.userId,
      body: `Queued followup: ${kind}${payload.note ? ` — ${payload.note}` : ''}`,
    });

  revalidatePath(`/ideas/${ideaId}`);
  return { ok: true };
}
