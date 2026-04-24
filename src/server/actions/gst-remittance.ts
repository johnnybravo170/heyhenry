'use server';

/**
 * GST/HST remittance filing actions.
 *
 * Mark a period as filed → persists a gst_remittances row. Unmark →
 * deletes it. Allowed for owner/admin/bookkeeper; workers never see
 * the GST pages so there's no path for them to hit these.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { createAdminClient } from '@/lib/supabase/admin';

type FileResult = { ok: true; id: string } | { ok: false; error: string };

const FILE_ROLES = new Set(['owner', 'admin', 'bookkeeper']);

const markSchema = z.object({
  period_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_cents: z.coerce.number().int(),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().trim().max(200).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export async function markGstRemittancePaidAction(input: {
  period_from: string;
  period_to: string;
  amount_cents: number;
  paid_at: string;
  reference?: string;
  notes?: string;
}): Promise<FileResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };
  if (!FILE_ROLES.has(tenant.member.role)) {
    return { ok: false, error: 'Only owners, admins, and bookkeepers can file remittances.' };
  }
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };
  if (parsed.data.period_to < parsed.data.period_from) {
    return { ok: false, error: 'Period end must be on or after period start.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('gst_remittances')
    .insert({
      tenant_id: tenant.id,
      period_from: parsed.data.period_from,
      period_to: parsed.data.period_to,
      amount_cents: parsed.data.amount_cents,
      paid_at: parsed.data.paid_at,
      reference: parsed.data.reference || null,
      notes: parsed.data.notes || null,
      created_by: tenant.member.id,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: 'This period is already marked filed. Unmark it first if you need to re-record.',
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/expenses/gst');
  revalidatePath('/bk/gst');
  revalidatePath('/bk');
  return { ok: true, id: data.id as string };
}

export async function unmarkGstRemittanceAction(input: {
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };
  if (!FILE_ROLES.has(tenant.member.role)) {
    return { ok: false, error: 'Only owners, admins, and bookkeepers can edit remittances.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('gst_remittances')
    .delete()
    .eq('id', input.id)
    .eq('tenant_id', tenant.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/expenses/gst');
  revalidatePath('/bk/gst');
  revalidatePath('/bk');
  return { ok: true };
}
