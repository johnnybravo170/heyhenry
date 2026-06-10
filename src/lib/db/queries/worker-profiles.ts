import { createAdminClient } from '@/lib/supabase/admin';

export type WorkerProfileRow = {
  id: string;
  tenant_id: string;
  /** Null for GC-managed workers who have no app account. */
  tenant_member_id: string | null;
  worker_type: 'employee' | 'subcontractor';
  /** Name set by the GC for profiles with no app account. */
  gc_managed_name: string | null;
  display_name: string | null;
  phone: string | null;
  business_name: string | null;
  gst_number: string | null;
  address: string | null;
  default_hourly_rate_cents: number | null;
  default_charge_rate_cents: number | null;
  tax_rate: number;
  can_log_expenses: boolean | null;
  can_invoice: boolean | null;
  nudge_email: boolean;
  nudge_sms: boolean;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, tenant_id, tenant_member_id, worker_type, gc_managed_name, display_name, phone, business_name, gst_number, address, default_hourly_rate_cents, default_charge_rate_cents, tax_rate, can_log_expenses, can_invoice, nudge_email, nudge_sms, created_at, updated_at';

/** Get a worker's profile by tenant_member id. Auto-creates on first read. */
export async function getOrCreateWorkerProfile(
  tenantId: string,
  tenantMemberId: string,
): Promise<WorkerProfileRow> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('worker_profiles')
    .select(COLUMNS)
    .eq('tenant_member_id', tenantMemberId)
    .maybeSingle();

  if (existing) return existing as WorkerProfileRow;

  const { data: created, error } = await admin
    .from('worker_profiles')
    .insert({ tenant_id: tenantId, tenant_member_id: tenantMemberId })
    .select(COLUMNS)
    .single();

  if (error || !created) throw new Error(error?.message ?? 'Failed to create worker profile.');
  return created as WorkerProfileRow;
}

/** Create a GC-managed worker profile with no app account. */
export async function createGcManagedWorkerProfile(
  tenantId: string,
  input: {
    gc_managed_name: string;
    phone?: string | null;
    worker_type?: 'employee' | 'subcontractor';
    default_hourly_rate_cents?: number | null;
    default_charge_rate_cents?: number | null;
    can_log_expenses?: boolean | null;
    can_invoice?: boolean | null;
  },
): Promise<WorkerProfileRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('worker_profiles')
    .insert({
      tenant_id: tenantId,
      gc_managed_name: input.gc_managed_name,
      phone: input.phone ?? null,
      worker_type: input.worker_type ?? 'employee',
      default_hourly_rate_cents: input.default_hourly_rate_cents ?? null,
      default_charge_rate_cents: input.default_charge_rate_cents ?? null,
      can_log_expenses: input.can_log_expenses ?? null,
      can_invoice: input.can_invoice ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create worker profile.');
  return data as WorkerProfileRow;
}

export async function listWorkerProfiles(tenantId: string): Promise<WorkerProfileRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('worker_profiles')
    .select(COLUMNS)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkerProfileRow[];
}

/** GC-managed profiles only — no app account (tenant_member_id IS NULL). */
export async function listGcManagedWorkers(tenantId: string): Promise<WorkerProfileRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('worker_profiles')
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .is('tenant_member_id', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkerProfileRow[];
}

export async function deleteGcManagedWorkerProfile(
  tenantId: string,
  profileId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('worker_profiles')
    .delete()
    .eq('id', profileId)
    .eq('tenant_id', tenantId)
    .is('tenant_member_id', null);
  if (error) throw new Error(error?.message ?? 'Failed to delete worker profile.');
}

export type WorkerProfileUpdate = Partial<{
  display_name: string | null;
  phone: string | null;
  business_name: string | null;
  gst_number: string | null;
  address: string | null;
  default_hourly_rate_cents: number | null;
  default_charge_rate_cents: number | null;
  tax_rate: number;
  worker_type: 'employee' | 'subcontractor';
  can_log_expenses: boolean | null;
  can_invoice: boolean | null;
  nudge_email: boolean;
  nudge_sms: boolean;
}>;

export async function updateWorkerProfile(
  tenantId: string,
  profileId: string,
  patch: WorkerProfileUpdate,
): Promise<WorkerProfileRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('worker_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .eq('tenant_id', tenantId)
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to update worker profile.');
  return data as WorkerProfileRow;
}
