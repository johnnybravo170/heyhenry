'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/ops-gate';
import { createServiceClient } from '@/lib/supabase';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const LANES = ['product', 'marketing', 'ops', 'sales', 'research'];

export async function createRoadmapItemAction(input: {
  lane: string;
  title: string;
  body: string | null;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!input.title.trim()) return { ok: false, error: 'Title required.' };
  if (!LANES.includes(input.lane)) return { ok: false, error: 'Invalid lane.' };

  const service = createServiceClient();
  const { data, error } = await service
    .schema('ops')
    .from('roadmap_items')
    .insert({
      actor_type: 'human',
      actor_name: admin.email,
      admin_user_id: admin.userId,
      lane: input.lane,
      title: input.title.trim(),
      body: input.body,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create.' };

  await service.schema('ops').from('roadmap_activity').insert({
    item_id: data.id,
    actor_type: 'human',
    actor_name: admin.email,
    kind: 'created',
    to_value: input.lane,
  });

  revalidatePath('/roadmap');
  return { ok: true, id: data.id as string };
}
