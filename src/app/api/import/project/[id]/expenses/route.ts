/**
 * POST /api/import/project/:id/expenses
 * Batch-append historical material purchases, bills, and sub costs.
 *
 * Auth: Bearer HEYHENRY_IMPORT_TOKEN, service-role admin client.
 * Stores raw hard_cost_cents only — markup is rendered, never stored.
 * is_billable controls whether a row enters the cost-plus invoice base.
 *
 * amount_cents on project_costs is GROSS (hard_cost_cents + gst_cents).
 * The paid_at consistency check requires paid_at IS NOT NULL when paid.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardImportRequest, resolveProject } from '@/lib/import/auth';
import { dryRunEnvelope, FORBIDDEN_LINE_LABEL, zodErrorResponse } from '@/lib/import/helpers';

const ExpenseSchema = z.object({
  source_row_id: z.string().min(1),
  label: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  vendor: z.string().optional(),
  hard_cost_cents: z.number().int().min(0),
  gst_cents: z.number().int().min(0).default(0),
  is_billable: z.boolean().default(true),
  source_type: z.enum(['receipt', 'vendor_bill']).default('vendor_bill'),
  payment_status: z.enum(['paid', 'unpaid']).default('unpaid'),
  paid_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  budget_category_id: z.string().uuid().optional(),
});

const BodySchema = z.object({
  tenant_id: z.string().uuid(),
  expenses: z.array(ExpenseSchema).min(1),
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

  const { expenses, options } = parsed.data;
  const dryRun = options?.dry_run ?? false;

  // Reject management fee / margin / precomputed total labels.
  for (const e of expenses) {
    if (FORBIDDEN_LINE_LABEL.test(e.label)) {
      return NextResponse.json(
        {
          error: 'validation',
          issues: [
            {
              message: `label "${e.label}" looks like a fee/tax total — store raw hard cost only`,
              path: 'label',
            },
          ],
        },
        { status: 422 },
      );
    }
  }

  if (dryRun) {
    return NextResponse.json(dryRunEnvelope('expenses', expenses, expenses.length));
  }

  const rows = expenses.map((e) => {
    const isPaid = e.payment_status === 'paid';
    const paidAt = isPaid ? `${e.paid_date ?? e.date}T00:00:00.000Z` : null;

    return {
      tenant_id: tenantId,
      project_id: projectId,
      description: e.label.trim(),
      vendor: e.vendor?.trim() || null,
      cost_date: e.date,
      source_type: e.source_type,
      payment_status: e.payment_status,
      paid_at: paidAt,
      amount_cents: e.hard_cost_cents + e.gst_cents,
      pre_tax_amount_cents: e.hard_cost_cents,
      gst_cents: e.gst_cents,
      is_billable: e.is_billable,
      budget_category_id: e.budget_category_id ?? null,
      status: 'active' as const,
      import_source_row_id: e.source_row_id,
    };
  });

  const { data, error } = await admin
    .from('project_costs')
    .upsert(rows, { onConflict: 'tenant_id,import_source_row_id', ignoreDuplicates: false })
    .select('id');

  if (error) {
    console.error('[import/expenses] insert failed', error.message);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  await admin.from('worklog_entries').insert({
    tenant_id: tenantId,
    entry_type: 'system',
    title: 'Expenses imported',
    body: `${data?.length ?? 0} expense ${data?.length === 1 ? 'row' : 'rows'} imported for project.`,
    related_type: 'project',
    related_id: projectId,
  });

  return NextResponse.json({ ok: true, count: data?.length ?? 0 });
}
