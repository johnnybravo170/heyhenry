'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/ops-gate';
import { createServiceClient } from '@/lib/supabase';

export type ActionResult = { ok: true } | { ok: false; error: string };

type Bundle = {
  id: string;
  bucket: string;
  status: string;
  question: string;
  recommendation: string | null;
  why_today: string | null;
};

async function loadBundle(id: string): Promise<Bundle | null> {
  const service = createServiceClient();
  const { data } = await service
    .schema('ops')
    .from('decision_bundles')
    .select('id, bucket, status, question, recommendation, why_today')
    .eq('id', id)
    .maybeSingle();
  return (data as Bundle) ?? null;
}

function settled(status: string): boolean {
  return status === 'resolved' || status === 'archived';
}

/**
 * Resolve a bundle by accepting it: a chosen option (decision/go_nogo) or
 * "do it" (research/grooming). Logs the call into ops.decisions and links it.
 */
export async function resolveBundleAction(input: {
  id: string;
  choice: string;
  note?: string;
  rating?: number;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const bundle = await loadBundle(input.id);
  if (!bundle) return { ok: false, error: 'Bundle not found.' };
  if (settled(bundle.status)) return { ok: false, error: 'Already resolved.' };
  if (!input.choice.trim()) return { ok: false, error: 'A choice is required.' };

  const service = createServiceClient();

  const hypothesisParts = [bundle.recommendation, bundle.why_today, input.note?.trim()].filter(
    (s): s is string => Boolean(s && s.trim()),
  );
  const { data: decision, error: decisionErr } = await service
    .schema('ops')
    .from('decisions')
    .insert({
      actor_type: 'human',
      actor_name: admin.email,
      admin_user_id: admin.userId,
      title: bundle.question.slice(0, 500),
      hypothesis: hypothesisParts.join('\n\n') || bundle.question,
      action: `Command Center: ${input.choice}`,
      tags: ['from-command-center', bundle.bucket],
    })
    .select('id')
    .single();
  if (decisionErr || !decision) {
    return { ok: false, error: decisionErr?.message ?? 'Failed to log decision.' };
  }

  const { error } = await service
    .schema('ops')
    .from('decision_bundles')
    .update({
      status: 'resolved',
      choice: input.choice,
      rating: input.rating ?? null,
      resolution_note: input.note?.trim() || null,
      decision_id: decision.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/queue');
  return { ok: true };
}

/**
 * Park a good-but-premature item with a resurface trigger. Not a delete —
 * the Routine wakes it back into triage when the now-context stage advances.
 */
export async function parkBundleAction(input: {
  id: string;
  resurface_trigger: string;
  note?: string;
  rating?: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const bundle = await loadBundle(input.id);
  if (!bundle) return { ok: false, error: 'Bundle not found.' };
  if (settled(bundle.status)) return { ok: false, error: 'Already resolved.' };
  if (!input.resurface_trigger.trim()) {
    return { ok: false, error: 'A resurface trigger is required (e.g. resurface:v1).' };
  }

  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('decision_bundles')
    .update({
      status: 'parked',
      choice: 'not_now',
      resurface_trigger: input.resurface_trigger.trim(),
      rating: input.rating ?? null,
      resolution_note: input.note?.trim() || null,
    })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/queue');
  return { ok: true };
}

/** Dismiss an item for good ("never"), with a one-line reason. */
export async function archiveBundleAction(input: {
  id: string;
  note?: string;
  rating?: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const bundle = await loadBundle(input.id);
  if (!bundle) return { ok: false, error: 'Bundle not found.' };
  if (settled(bundle.status)) return { ok: false, error: 'Already resolved.' };

  const service = createServiceClient();
  const { error } = await service
    .schema('ops')
    .from('decision_bundles')
    .update({
      status: 'archived',
      choice: 'never',
      rating: input.rating ?? null,
      resolution_note: input.note?.trim() || null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/queue');
  return { ok: true };
}
