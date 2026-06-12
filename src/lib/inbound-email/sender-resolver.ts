/**
 * Resolve a forwarder's From-address header to the tenant they own/admin.
 *
 * Backed by the `resolve_inbound_sender(text)` SECURITY DEFINER RPC
 * (migration 0178), which joins auth.users → tenant_members and returns
 * the matched tenant_id, or NULL for unknown OR ambiguous senders.
 *
 * The app layer can't query auth.users directly — only Supabase's
 * paginated admin.auth.admin.listUsers() exists, which is wrong for a
 * per-request lookup. Hence the RPC.
 */

import { createAdminClient } from '@/lib/supabase/admin';

/** Strip "Display Name <addr@domain>" → "addr@domain" lowercase + trimmed. */
export function normaliseEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

type InboundHeader = { Name: string; Value: string };

function headerValue(headers: InboundHeader[], name: string): string | null {
  const target = name.toLowerCase();
  const hit = headers.find((h) => h.Name?.toLowerCase() === target);
  return hit?.Value ?? null;
}

/**
 * Decide whether the SENDER's From address can be trusted as a real
 * tenant-member forward, based on the SPF/DKIM verdict Postmark forwards
 * in the inbound `Headers`.
 *
 * Conservative by design: we only return `false` on an EXPLICIT SPF
 * fail/softfail or an explicit DKIM fail. Absent headers (Postmark doesn't
 * always include them) return `true` so we don't break legitimate forwards
 * that happen to lack a verdict. The point is to stop a spoofed `From:
 * owner@tenant.com` from being attributed to that tenant's intake — which
 * only succeeds when the verdict explicitly fails.
 */
export function senderPassesEmailAuth(headers: InboundHeader[]): boolean {
  // Received-SPF: e.g. "Pass (...)", "Fail (...)", "SoftFail (...)".
  const spf = headerValue(headers, 'Received-SPF');
  if (spf) {
    const verdict = spf.trim().toLowerCase();
    if (verdict.startsWith('fail') || verdict.startsWith('softfail')) return false;
  }

  // Authentication-Results carries both spf=... and dkim=... tokens.
  const authResults = headerValue(headers, 'Authentication-Results');
  if (authResults) {
    const lower = authResults.toLowerCase();
    if (/\bspf=(fail|softfail)\b/.test(lower)) return false;
    if (/\bdkim=fail\b/.test(lower)) return false;
  }

  return true;
}

export async function resolveSenderToTenant(fromHeader: string): Promise<string | null> {
  const email = normaliseEmail(fromHeader);
  if (!email.includes('@')) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('resolve_inbound_sender', { p_email: email });
  if (error) {
    console.error('[sender-resolver] RPC failed', error);
    return null;
  }
  return (data as string | null) ?? null;
}
