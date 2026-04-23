'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/ops-gate';
import { createServiceClient } from '@/lib/supabase';

export async function revokeMcpTokenAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const service = createServiceClient();

  const { error } = await service
    .schema('ops')
    .from('oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  await service
    .schema('ops')
    .from('audit_log')
    .insert({
      admin_user_id: admin.userId,
      method: 'DELETE',
      path: `/admin/mcp/tokens/${id}`,
      status: 200,
    });

  revalidatePath('/admin/mcp');
  return { ok: true };
}

export async function revokeAllMcpTokensAction(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const admin = await requireAdmin();
  const service = createServiceClient();

  const { data, error } = await service
    .schema('ops')
    .from('oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .is('revoked_at', null)
    .select('id');
  if (error) return { ok: false, error: error.message };

  await service
    .schema('ops')
    .from('audit_log')
    .insert({
      admin_user_id: admin.userId,
      method: 'DELETE',
      path: '/admin/mcp/tokens',
      status: 200,
      reason: `Bulk revoke (${data?.length ?? 0} tokens)`,
    });

  revalidatePath('/admin/mcp');
  return { ok: true, count: data?.length ?? 0 };
}
