/**
 * Photo share links — scoped no-login public URLs.
 *
 * Token generation uses `crypto.randomBytes` to produce a URL-safe 16-byte
 * identifier. Not a UUID because we want short URLs (~22 chars) that fit
 * nicely in an email CTA.
 */

import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export type ShareScopeType = 'job_full' | 'job_live' | 'album' | 'pair_set' | 'single';

export function generateShareToken(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Find an existing matching share link or create a new one. De-duping
 * matters because Complete can be tapped more than once; we don't want to
 * accumulate a dozen tokens per job.
 */
export async function getOrCreateShareLink(params: {
  tenantId: string;
  scopeType: ShareScopeType;
  scopeId: string;
  label?: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  recipientName?: string | null;
  createdByUserId?: string | null;
}): Promise<{ token: string; created: boolean }> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('photo_share_links')
    .select('token')
    .eq('tenant_id', params.tenantId)
    .eq('scope_type', params.scopeType)
    .eq('scope_id', params.scopeId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.token) return { token: existing.token as string, created: false };

  const token = generateShareToken();
  const { error } = await admin.from('photo_share_links').insert({
    tenant_id: params.tenantId,
    token,
    scope_type: params.scopeType,
    scope_id: params.scopeId,
    label: params.label ?? null,
    recipient_email: params.recipientEmail ?? null,
    recipient_phone: params.recipientPhone ?? null,
    recipient_name: params.recipientName ?? null,
    created_by_user_id: params.createdByUserId ?? null,
  });
  if (error) throw new Error(`getOrCreateShareLink: ${error.message}`);
  return { token, created: true };
}

export type ShareLinkLookup = {
  id: string;
  tenantId: string;
  scopeType: ShareScopeType;
  scopeId: string;
  label: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
};

export async function lookupShareLink(token: string): Promise<ShareLinkLookup | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('photo_share_links')
    .select('id, tenant_id, scope_type, scope_id, label, revoked_at, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (error || !data) return null;

  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) return null;

  return {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    scopeType: data.scope_type as ShareScopeType,
    scopeId: data.scope_id as string,
    label: (data.label as string | null) ?? null,
    revokedAt: (data.revoked_at as string | null) ?? null,
    expiresAt: (data.expires_at as string | null) ?? null,
  };
}

export async function recordShareLinkView(token: string, clientIp: string | null): Promise<void> {
  const admin = createAdminClient();
  // Best-effort — if the row doesn't exist the update is a no-op.
  await admin
    .from('photo_share_links')
    .update({
      view_count: await nextViewCount(token),
      last_viewed_at: new Date().toISOString(),
      last_viewed_ip: clientIp,
    })
    .eq('token', token);
}

async function nextViewCount(token: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('photo_share_links')
    .select('view_count')
    .eq('token', token)
    .maybeSingle();
  return ((data?.view_count as number) ?? 0) + 1;
}

export function buildShareUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.AR_PUBLIC_BASE_URL ?? 'https://app.heyhenry.io';
  return `${base.replace(/\/$/, '')}/g/${token}`;
}
