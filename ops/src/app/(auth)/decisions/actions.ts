'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/ops-gate';
import { createServiceClient } from '@/lib/supabase';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createDecisionAction(input: {
  title: string;
  hypothesis: string;
  action: string | null;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!input.title.trim()) return { ok: false, error: 'Title required.' };
  if (!input.hypothesis.trim()) return { ok: false, error: 'Hypothesis required.' };

  const service = createServiceClient();
  const { data, error } = await service
    .schema('ops')
    .from('decisions')
    .insert({
      actor_type: 'human',
      actor_name: admin.email,
      admin_user_id: admin.userId,
      title: input.title.trim(),
      hypothesis: input.hypothesis.trim(),
      action: input.action,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create.' };

  revalidatePath('/decisions');
  return { ok: true, id: data.id as string };
}
