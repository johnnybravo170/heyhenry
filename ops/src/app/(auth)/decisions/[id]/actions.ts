'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/ops-gate';
import { createServiceClient } from '@/lib/supabase';

export type ActionResult = { ok: true } | { ok: false; error: string };

const VALID_STATUS = ['open', 'measuring', 'learned', 'reverted', 'abandoned'];

export async function setDecisionStatusAction(id: string, status: string): Promise<ActionResult> {
  await requireAdmin();
  if (!VALID_STATUS.includes(status)) return { ok: false, error: 'Invalid status.' };
  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('decisions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/decisions/${id}`);
  revalidatePath('/decisions');
  return { ok: true };
}

export async function setDecisionActionAction(
  id: string,
  action: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('decisions')
    .update({ action, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/decisions/${id}`);
  return { ok: true };
}

export async function addDecisionOutcomeAction(
  decisionId: string,
  body: string,
  metrics: Record<string, unknown>,
  conclude: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!body.trim()) return { ok: false, error: 'Outcome body required.' };
  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('decision_outcomes')
    .insert({
      decision_id: decisionId,
      actor_type: 'human',
      actor_name: admin.email,
      body: body.trim(),
      metrics,
      concluded_at: conclude ? new Date().toISOString() : null,
    });
  if (error) return { ok: false, error: error.message };

  // If concluding, bump decision status to 'learned' unless already terminal.
  if (conclude) {
    const { data: cur } = await service
      .schema('ops')
      .from('decisions')
      .select('status')
      .eq('id', decisionId)
      .maybeSingle();
    if (cur && ['open', 'measuring'].includes(cur.status as string)) {
      await service
        .schema('ops')
        .from('decisions')
        .update({ status: 'learned', updated_at: new Date().toISOString() })
        .eq('id', decisionId);
    }
  }

  revalidatePath(`/decisions/${decisionId}`);
  revalidatePath('/decisions');
  return { ok: true };
}

export async function addDecisionCommentAction(
  decisionId: string,
  body: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!body.trim()) return { ok: false, error: 'Comment required.' };
  const service = createServiceClient();
  const { error } = await service.schema('ops').from('decision_comments').insert({
    decision_id: decisionId,
    actor_type: 'human',
    actor_name: admin.email,
    admin_user_id: admin.userId,
    body: body.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/decisions/${decisionId}`);
  return { ok: true };
}
