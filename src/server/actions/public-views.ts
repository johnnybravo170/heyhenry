'use server';

import { createAdminClient } from '@/lib/supabase/admin';

type LogViewInput = {
  sessionId?: string;
  userAgent?: string;
  ipHash?: string;
};

async function insertView(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    tenant_id: string;
    resource_type: 'estimate' | 'portal' | 'invoice' | 'change_order' | 'quote';
    resource_id: string;
    project_id?: string | null;
    event_kind?: string;
  } & LogViewInput,
) {
  await admin.from('public_page_views').insert({
    tenant_id: params.tenant_id,
    resource_type: params.resource_type,
    resource_id: params.resource_id,
    session_id: params.sessionId ?? null,
    ip_hash: params.ipHash ?? null,
    user_agent: params.userAgent ?? null,
  });

  if (params.project_id && params.event_kind) {
    await admin.from('project_events').insert({
      tenant_id: params.tenant_id,
      project_id: params.project_id,
      kind: params.event_kind,
      actor: 'customer',
    });
  }
}

export async function logChangeOrderViewAction(
  approvalCode: string,
  input: LogViewInput = {},
): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { data: co } = await admin
    .from('change_orders')
    .select('id, tenant_id, project_id')
    .eq('approval_code', approvalCode)
    .single();
  if (!co) return { ok: false };
  const c = co as Record<string, unknown>;
  await insertView(admin, {
    tenant_id: c.tenant_id as string,
    resource_type: 'change_order',
    resource_id: c.id as string,
    project_id: (c.project_id as string | null) ?? null,
    event_kind: c.project_id ? 'change_order_viewed' : undefined,
    ...input,
  });
  return { ok: true };
}

export async function logPortalViewAction(
  portalSlug: string,
  input: LogViewInput = {},
): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from('projects')
    .select('id, tenant_id')
    .eq('portal_slug', portalSlug)
    .eq('portal_enabled', true)
    .is('deleted_at', null)
    .single();
  if (!project) return { ok: false };
  const p = project as Record<string, unknown>;
  await insertView(admin, {
    tenant_id: p.tenant_id as string,
    resource_type: 'portal',
    resource_id: p.id as string,
    project_id: p.id as string,
    event_kind: 'portal_viewed',
    ...input,
  });
  return { ok: true };
}

export async function logInvoiceViewAction(
  invoiceId: string,
  input: LogViewInput = {},
): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from('invoices')
    .select('id, tenant_id, project_id, status')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();
  if (!inv) return { ok: false };
  const i = inv as Record<string, unknown>;
  if (i.status === 'draft') return { ok: false };
  await insertView(admin, {
    tenant_id: i.tenant_id as string,
    resource_type: 'invoice',
    resource_id: i.id as string,
    project_id: (i.project_id as string | null) ?? null,
    event_kind: i.project_id ? 'invoice_viewed' : undefined,
    ...input,
  });
  return { ok: true };
}

export async function logQuoteViewAction(
  quoteId: string,
  input: LogViewInput = {},
): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { data: q } = await admin
    .from('quotes')
    .select('id, tenant_id, status')
    .eq('id', quoteId)
    .is('deleted_at', null)
    .single();
  if (!q) return { ok: false };
  const qq = q as Record<string, unknown>;
  if (qq.status === 'draft') return { ok: false };
  await insertView(admin, {
    tenant_id: qq.tenant_id as string,
    resource_type: 'quote',
    resource_id: qq.id as string,
    ...input,
  });
  return { ok: true };
}
