'use server';

/**
 * Server actions for per-user owner-dashboard UI preferences. Persisted on
 * the caller's tenant_members row (scoped to the active tenant by the
 * tenant_members_update_self RLS policy — migration 0152).
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/helpers';
import { normalizeSectionOrder } from '@/lib/dashboard/sections';
import { createClient } from '@/lib/supabase/server';

export async function saveDashboardSectionOrderAction(input: {
  order: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Normalize before persisting so a malformed client payload can never
  // poison the stored value — we only ever write the known key set.
  const order = normalizeSectionOrder(input.order);

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenant_members')
    .update({ dashboard_section_order: order, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('is_active_for_user', true);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard');
  return { ok: true };
}
