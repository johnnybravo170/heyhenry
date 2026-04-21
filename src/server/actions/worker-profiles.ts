'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentTenant } from '@/lib/auth/helpers';
import {
  getOrCreateWorkerProfile,
  updateWorkerProfile,
  type WorkerProfileUpdate,
} from '@/lib/db/queries/worker-profiles';
import { createAdminClient } from '@/lib/supabase/admin';

const selfSchema = z.object({
  display_name: z.string().trim().max(120).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  business_name: z.string().trim().max(120).optional().default(''),
  gst_number: z.string().trim().max(40).optional().default(''),
  address: z.string().trim().max(240).optional().default(''),
  default_hourly_rate_dollars: z.string().trim().optional().default(''),
  nudge_email: z.boolean().optional().default(true),
  nudge_sms: z.boolean().optional().default(false),
});

export async function updateOwnWorkerProfileAction(
  input: z.input<typeof selfSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };
  if (tenant.member.role !== 'worker') return { ok: false, error: 'Not a worker.' };

  const parsed = selfSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };
  const v = parsed.data;

  const profile = await getOrCreateWorkerProfile(tenant.id, tenant.member.id);

  const rateDollars = v.default_hourly_rate_dollars.trim();
  const rateCents = rateDollars === '' ? null : Math.round(Number(rateDollars) * 100);
  if (rateCents !== null && (!Number.isFinite(rateCents) || rateCents < 0)) {
    return { ok: false, error: 'Hourly rate must be a positive number.' };
  }

  const patch: WorkerProfileUpdate = {
    display_name: v.display_name || null,
    phone: v.phone || null,
    business_name: v.business_name || null,
    gst_number: v.gst_number || null,
    address: v.address || null,
    default_hourly_rate_cents: rateCents,
    nudge_email: v.nudge_email,
    nudge_sms: v.nudge_sms,
  };

  try {
    await updateWorkerProfile(tenant.id, profile.id, patch);
    revalidatePath('/w/profile');
    revalidatePath('/w');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update profile.' };
  }
}

// ---------------------------------------------------------------------------
// Owner/admin-side actions (Settings > Team)
// ---------------------------------------------------------------------------

const ownerSchema = z.object({
  profile_id: z.string().uuid(),
  worker_type: z.enum(['employee', 'subcontractor']),
  can_log_expenses: z.enum(['inherit', 'yes', 'no']),
  can_invoice: z.enum(['inherit', 'yes', 'no']),
  default_hourly_rate_dollars: z.string().trim().optional().default(''),
});

function triToBool(value: 'inherit' | 'yes' | 'no'): boolean | null {
  if (value === 'inherit') return null;
  return value === 'yes';
}

export async function updateWorkerCapabilitiesAction(
  input: z.input<typeof ownerSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };
  if (tenant.member.role !== 'owner' && tenant.member.role !== 'admin') {
    return { ok: false, error: 'Only owners and admins can edit worker capabilities.' };
  }

  const parsed = ownerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };
  const v = parsed.data;

  const rateDollars = v.default_hourly_rate_dollars.trim();
  const rateCents = rateDollars === '' ? null : Math.round(Number(rateDollars) * 100);
  if (rateCents !== null && (!Number.isFinite(rateCents) || rateCents < 0)) {
    return { ok: false, error: 'Hourly rate must be a positive number.' };
  }

  try {
    await updateWorkerProfile(tenant.id, v.profile_id, {
      worker_type: v.worker_type,
      can_log_expenses: triToBool(v.can_log_expenses),
      can_invoice: triToBool(v.can_invoice),
      default_hourly_rate_cents: rateCents,
    });
    revalidatePath('/settings/team');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update worker.' };
  }
}

const defaultsSchema = z.object({
  workers_can_log_expenses: z.boolean(),
  workers_can_invoice_default: z.boolean(),
});

export async function updateWorkerDefaultsAction(
  input: z.input<typeof defaultsSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };
  if (tenant.member.role !== 'owner' && tenant.member.role !== 'admin') {
    return { ok: false, error: 'Only owners and admins can change tenant defaults.' };
  }

  const parsed = defaultsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('tenants')
    .update({
      workers_can_log_expenses: parsed.data.workers_can_log_expenses,
      workers_can_invoice_default: parsed.data.workers_can_invoice_default,
    })
    .eq('id', tenant.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings/team');
  return { ok: true };
}
