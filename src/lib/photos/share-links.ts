/**
 * Photo share links — scoped no-login public URLs.
 *
 * URL shape: `{baseUrl}/g/{slug}-{token}`
 *   slug    — cosmetic (e.g. "sarah-chen"), helps the recipient recognize
 *             the link at a glance. Nullable for backwards compat.
 *   token   — 8-char base64url random (~48 bits entropy), the actual key.
 *
 * Lookup is by token only. If the visited path carries a mismatched slug,
 * the route layer 302s to the canonical URL (SEO + friendlier bookmarks).
 */

import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export type ShareScopeType = 'job_full' | 'job_live' | 'album' | 'pair_set' | 'single';

/**
 * Short random token. 6 bytes → 8 base64url chars → 48 bits entropy.
 * Tokens are namespaced by the `photo_share_links.token` UNIQUE index, so
 * collision handling happens at INSERT time (retry on failure).
 */
export function generateShareToken(): string {
  return randomBytes(6).toString('base64url');
}

/**
 * Convert a free-form name into a URL-safe slug. Latin-only; anything
 * unsupported (emoji, non-Latin script) gets stripped and we fall back to
 * an empty string (which means the URL becomes just `/g/{token}`).
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40); // keep URLs sane
}

/**
 * Build the public URL for a share link.
 */
export function buildShareUrl(params: {
  token: string;
  slug?: string | null;
  baseUrl?: string;
}): string {
  const base = (
    params.baseUrl ??
    process.env.AR_PUBLIC_BASE_URL ??
    'https://app.heyhenry.io'
  ).replace(/\/$/, '');
  const handle =
    params.slug && params.slug.length > 0 ? `${params.slug}-${params.token}` : params.token;
  return `${base}/g/${handle}`;
}

/**
 * Split a URL handle like `sarah-chen-a7bZ9dR2` into `{slug, token}`.
 * The token is always the last hyphen-separated segment; anything before
 * is the slug. If the handle has no hyphen, the whole thing is the token.
 */
export function parseShareHandle(handle: string): { slug: string | null; token: string } {
  const idx = handle.lastIndexOf('-');
  if (idx < 0) return { slug: null, token: handle };
  return {
    slug: handle.slice(0, idx),
    token: handle.slice(idx + 1),
  };
}

export async function getOrCreateShareLink(params: {
  tenantId: string;
  scopeType: ShareScopeType;
  scopeId: string;
  slug?: string | null;
  label?: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  recipientName?: string | null;
  createdByUserId?: string | null;
}): Promise<{ token: string; slug: string | null; created: boolean }> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('photo_share_links')
    .select('token, slug')
    .eq('tenant_id', params.tenantId)
    .eq('scope_type', params.scopeType)
    .eq('scope_id', params.scopeId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.token) {
    return {
      token: existing.token as string,
      slug: (existing.slug as string | null) ?? null,
      created: false,
    };
  }

  const token = generateShareToken();
  const slug = params.slug && params.slug.length > 0 ? params.slug : null;
  const { error } = await admin.from('photo_share_links').insert({
    tenant_id: params.tenantId,
    token,
    slug,
    scope_type: params.scopeType,
    scope_id: params.scopeId,
    label: params.label ?? null,
    recipient_email: params.recipientEmail ?? null,
    recipient_phone: params.recipientPhone ?? null,
    recipient_name: params.recipientName ?? null,
    created_by_user_id: params.createdByUserId ?? null,
  });
  if (error) throw new Error(`getOrCreateShareLink: ${error.message}`);
  return { token, slug, created: true };
}

export type ShareLinkLookup = {
  id: string;
  tenantId: string;
  scopeType: ShareScopeType;
  scopeId: string;
  token: string;
  slug: string | null;
  label: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
};

export async function lookupShareLink(token: string): Promise<ShareLinkLookup | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('photo_share_links')
    .select('id, tenant_id, scope_type, scope_id, token, slug, label, revoked_at, expires_at')
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
    token: data.token as string,
    slug: (data.slug as string | null) ?? null,
    label: (data.label as string | null) ?? null,
    revokedAt: (data.revoked_at as string | null) ?? null,
    expiresAt: (data.expires_at as string | null) ?? null,
  };
}

export async function recordShareLinkView(token: string, clientIp: string | null): Promise<void> {
  const admin = createAdminClient();
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
