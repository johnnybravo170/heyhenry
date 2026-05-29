'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/ops-gate';
import { createServiceClient } from '@/lib/supabase';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Activate a proposed scout-policy version. Goes through the
 * ops.activate_scout_policy RPC, which atomically supersedes the scout's
 * current active row and flips the target to active (preserving the
 * one-active-per-scout invariant). Never two sequential app-code updates.
 */
export async function activateScoutPolicyAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const service = createServiceClient();
  const { error } = await service.schema('ops').rpc('activate_scout_policy', {
    p_policy_id: id,
    p_admin_user_id: admin.userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/scout-policy');
  return { ok: true };
}

/**
 * Reject a proposed scout-policy version. Only a `proposed` row can be
 * rejected (guarded so we never clobber an active/superseded one). An optional
 * reason is appended to `rationale` with a marker — preserving the learner's
 * original rationale — so a future scout-learner can read WHY it was rejected
 * and not re-propose the same thing. (No dedicated review_note column yet —
 * appended to rationale to avoid a schema change with no consumer.)
 */
export async function rejectScoutPolicyAction(input: {
  id: string;
  note?: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const service = createServiceClient();

  const { data: existing, error: readErr } = await service
    .schema('ops')
    .from('scout_policy')
    .select('status, rationale')
    .eq('id', input.id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: 'Policy version not found.' };
  if (existing.status !== 'proposed') {
    return {
      ok: false,
      error: `Can only reject a proposed version (this one is ${existing.status}).`,
    };
  }

  const note = input.note?.trim();
  const stamp = `[REJECTED by ${admin.email} ${new Date().toISOString()}]${note ? `: ${note}` : ''}`;
  const nextRationale = existing.rationale ? `${existing.rationale}\n\n${stamp}` : stamp;

  const { data, error } = await service
    .schema('ops')
    .from('scout_policy')
    .update({ status: 'rejected', rationale: nextRationale, updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('status', 'proposed') // re-guard against a concurrent transition
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Already transitioned by another action.' };

  revalidatePath('/admin/scout-policy');
  return { ok: true };
}
