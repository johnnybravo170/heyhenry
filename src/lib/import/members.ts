import type { createAdminClient } from '@/lib/supabase/admin';

export type WorkerResolution =
  | { kind: 'matched'; workerProfileId: string; displayName: string }
  | { kind: 'unmatched'; rawName: string };

/**
 * Try to match a worker name against existing worker_profiles for the tenant.
 * Matching is case-insensitive on display_name OR first_name + last_name from
 * the linked tenant_member.
 *
 * Worker profiles require a real auth user (tenant_member + worker_profile chain),
 * so we cannot auto-create one here. Unmatched rows are flagged: callers store
 * the raw name in notes and leave worker_profile_id null. When the ghost-worker
 * feature lands, these rows can be retroactively linked.
 */
export async function resolveWorker(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  rawName: string,
): Promise<WorkerResolution> {
  const normalised = rawName.trim().toLowerCase();
  if (!normalised) return { kind: 'unmatched', rawName };

  const { data: profiles } = await admin
    .from('worker_profiles')
    .select(`
      id,
      display_name,
      tenant_members!inner (
        first_name,
        last_name
      )
    `)
    .eq('tenant_id', tenantId);

  for (const p of profiles ?? []) {
    const memberArr = Array.isArray(p.tenant_members) ? p.tenant_members : [p.tenant_members];
    for (const m of memberArr) {
      if (!m) continue;
      const memberName = [m.first_name, m.last_name].filter(Boolean).join(' ').toLowerCase();
      const displayName = (p.display_name ?? '').toLowerCase();
      if (
        (displayName && displayName === normalised) ||
        (memberName && memberName === normalised)
      ) {
        return {
          kind: 'matched',
          workerProfileId: p.id,
          displayName: p.display_name ?? [m.first_name, m.last_name].filter(Boolean).join(' '),
        };
      }
    }
  }

  return { kind: 'unmatched', rawName };
}

/**
 * Look up the tenant owner's tenant_member id. Used as `created_by` on
 * records that require a non-null member reference (e.g. change_orders).
 */
export async function resolveTenantOwnerMemberId(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
