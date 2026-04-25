/**
 * Resolve auth user_ids → human-readable display names for operators
 * (owner/admin/crew-not-in-worker_profiles). Pulls first/last from
 * tenant_members and falls back to the local part of their auth email.
 *
 * Returns a Map<userId, displayName>. Callers use it to label time entries,
 * expenses, comments, etc. so the UI never has to fall back to a generic
 * "Owner/admin" string when we actually know the person's name.
 *
 * Used by CostsTabServer + TimeTabServer; extract more callers as needed.
 */
import { createAdminClient } from '@/lib/supabase/admin';

export function composeOperatorName(params: {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  email: string | null | undefined;
}): string | undefined {
  const first = params.firstName?.trim();
  const last = params.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  if (params.email) {
    const local = params.email.split('@')[0];
    if (local) return local;
  }
  return undefined;
}

export async function getOperatorNamesForTenant(tenantId: string): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const { data: tenantMembers } = await admin
    .from('tenant_members')
    .select('user_id, first_name, last_name')
    .eq('tenant_id', tenantId);

  const memberUserIds = Array.from(
    new Set((tenantMembers ?? []).map((m) => m.user_id as string).filter(Boolean)),
  );
  const emailByUserId = new Map<string, string>();
  if (memberUserIds.length > 0) {
    const { data: authPage } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of authPage?.users ?? []) {
      if (u.email && memberUserIds.includes(u.id)) emailByUserId.set(u.id, u.email);
    }
  }

  const out = new Map<string, string>();
  for (const m of tenantMembers ?? []) {
    const name = composeOperatorName({
      firstName: m.first_name as string | null,
      lastName: m.last_name as string | null,
      email: emailByUserId.get(m.user_id as string),
    });
    if (name) out.set(m.user_id as string, name);
  }
  return out;
}
