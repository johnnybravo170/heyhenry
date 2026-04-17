/**
 * Worker invite queries.
 *
 * Most queries use the RLS-aware server client. The `findWorkerInviteByCode`
 * helper uses the admin client because the join page is accessed by
 * unauthenticated users (anon role can only see valid invites via RLS, but
 * we also need the tenant name join).
 */

import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** Generate a URL-safe 12-character code. */
function generateCode(): string {
  return randomBytes(9).toString('base64url').slice(0, 12);
}

export type WorkerInviteRow = {
  id: string;
  tenant_id: string;
  code: string;
  role: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export type WorkerInviteWithTenant = WorkerInviteRow & {
  tenant_name: string;
};

/** Create a new invite code with 7-day expiry. */
export async function createWorkerInvite(tenantId: string, createdBy: string) {
  const supabase = await createClient();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('worker_invites')
    .insert({
      tenant_id: tenantId,
      code,
      created_by: createdBy,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as WorkerInviteRow;
}

/**
 * Look up an invite by code. Uses the admin client so the join page works
 * for unauthenticated visitors. Returns null when the code is invalid,
 * used, revoked, or expired.
 */
export async function findWorkerInviteByCode(code: string): Promise<WorkerInviteWithTenant | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('worker_invites')
    .select('*, tenants(name)')
    .eq('code', code)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  const tenant = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants;
  return {
    ...(data as unknown as WorkerInviteRow),
    tenant_name: tenant?.name ?? 'Unknown',
  };
}

/** Mark an invite as used by a specific user. */
export async function markInviteUsed(inviteId: string, userId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from('worker_invites')
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq('id', inviteId);

  if (error) throw new Error(error.message);
}

/** Revoke an invite so it can no longer be used. */
export async function revokeInvite(inviteId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('worker_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId);

  if (error) throw new Error(error.message);
}

/** List all invites for the current tenant. */
export async function listInvitesByTenantId(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('worker_invites')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as WorkerInviteRow[];
}
