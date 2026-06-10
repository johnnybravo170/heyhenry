/**
 * POST /api/import/project/:id/invoices
 * Import historical invoices (including milestone draws) for a project.
 *
 * Auth: Bearer HEYHENRY_IMPORT_TOKEN, service-role admin client.
 *
 * Invoice shape: tax-exclusive (GST always on top, tax_inclusive=false).
 * amount_cents=0, line_items drive the subtotal, tax computed server-side.
 * Paid invoices have status='paid' set at insert — no status-transition
 * action needed since we're creating historical records directly.
 *
 * Draws (doc_type='draw') follow the same shape with customer_note as label
 * and optional percent_complete for milestone %. No separate draws table.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardImportRequest, resolveProject } from '@/lib/import/auth';
import { dryRunEnvelope, zodErrorResponse } from '@/lib/import/helpers';

const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit_price_cents: z.number().int().min(0),
});

const InvoiceSchema = z.object({
  source_row_id: z.string().min(1),
  number: z.string().optional(),
  issued_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'issued_date must be YYYY-MM-DD'),
  status: z.enum(['draft', 'sent', 'paid']),
  paid_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  line_items: z.array(LineItemSchema).min(1),
  label: z.string().optional(),
  percent_complete: z.number().int().min(0).max(100).optional(),
  is_draw: z.boolean().default(false),
});

const BodySchema = z.object({
  tenant_id: z.string().uuid(),
  invoices: z.array(InvoiceSchema).min(1),
  options: z.object({ dry_run: z.boolean().default(false) }).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardImportRequest(req);
  if (!guard.ok) return guard.res;
  const { admin, tenantId } = guard.ctx;

  const { id: projectId } = await params;
  const projectCheck = await resolveProject(admin, tenantId, projectId);
  if (!projectCheck.ok) return projectCheck.res;

  const parsed = BodySchema.safeParse(guard.body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { invoices, options } = parsed.data;
  const dryRun = options?.dry_run ?? false;

  if (dryRun) {
    return NextResponse.json(dryRunEnvelope('invoices', invoices, invoices.length));
  }

  // Load the project's contact_id and tax-exempt flag for GST computation.
  const { data: project } = await admin
    .from('projects')
    .select('contact_id')
    .eq('id', projectId)
    .single();

  if (!project?.contact_id) {
    return NextResponse.json({ error: 'project_missing_contact' }, { status: 422 });
  }

  const { data: contact } = await admin
    .from('contacts')
    .select('tax_exempt')
    .eq('id', project.contact_id)
    .maybeSingle();

  const taxExempt = Boolean(contact?.tax_exempt);
  const { canadianTax } = await import('@/lib/providers/tax/canadian');
  const taxCtx = await canadianTax.getCustomerFacingContext(tenantId);
  const taxRate = taxCtx.totalRate;

  const rows = invoices.map((inv) => {
    const items = inv.line_items.map((li) => ({
      description: li.description.trim(),
      quantity: li.quantity,
      unit_price_cents: li.unit_price_cents,
      total_cents: Math.round(li.quantity * li.unit_price_cents),
    }));

    const subtotalCents = items.reduce((s, li) => s + li.total_cents, 0);
    const taxCents = taxExempt ? 0 : Math.round(subtotalCents * taxRate);

    const issuedIso = `${inv.issued_date}T00:00:00.000Z`;
    const paidIso = inv.paid_date ? `${inv.paid_date}T00:00:00.000Z` : null;

    return {
      tenant_id: tenantId,
      project_id: projectId,
      contact_id: project.contact_id,
      status: inv.status,
      doc_type: inv.is_draw ? 'draw' : 'invoice',
      tax_inclusive: false,
      amount_cents: 0,
      line_items: items,
      tax_cents: taxCents,
      customer_note: inv.label?.trim() || null,
      percent_complete: inv.percent_complete ?? null,
      sent_at: inv.status === 'sent' || inv.status === 'paid' ? issuedIso : null,
      paid_at: inv.status === 'paid' ? (paidIso ?? issuedIso) : null,
      payment_method: inv.status === 'paid' ? 'import' : null,
      import_source_row_id: inv.source_row_id,
    };
  });

  const { data, error } = await admin
    .from('invoices')
    .upsert(rows, { onConflict: 'tenant_id,import_source_row_id', ignoreDuplicates: false })
    .select('id');

  if (error) {
    return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
  }

  await admin.from('worklog_entries').insert({
    tenant_id: tenantId,
    entry_type: 'system',
    title: 'Invoices imported',
    body: `${data?.length ?? 0} invoice${data?.length === 1 ? '' : 's'} imported for project.`,
    related_type: 'project',
    related_id: projectId,
  });

  return NextResponse.json({ ok: true, count: data?.length ?? 0 });
}
