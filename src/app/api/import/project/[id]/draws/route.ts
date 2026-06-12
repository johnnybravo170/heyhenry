/**
 * POST /api/import/project/:id/draws
 * Import historical owner draws (salary, dividend, reimbursement, other).
 *
 * Auth: Bearer HEYHENRY_IMPORT_TOKEN, service-role admin client.
 *
 * NOTE: These are owner_draws (owner pay ledger), NOT invoice milestone draws.
 * Invoice milestone draws are imported via the /invoices endpoint with is_draw=true.
 *
 * owner_draws are not project-scoped in the schema — they belong to the tenant.
 * We accept project_id in the payload for context/worklog but don't store it on the row.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardImportRequest, resolveProject } from '@/lib/import/auth';
import { dryRunEnvelope, zodErrorResponse } from '@/lib/import/helpers';

const DrawSchema = z.object({
  source_row_id: z.string().min(1),
  label: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  amount_cents: z.number().int().positive(),
  draw_type: z.enum(['salary', 'dividend', 'reimbursement', 'other']).default('other'),
});

const BodySchema = z.object({
  tenant_id: z.string().uuid(),
  draws: z.array(DrawSchema).min(1),
  options: z.object({ dry_run: z.boolean().default(false) }).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardImportRequest(req);
  if (!guard.ok) return guard.res;
  const { admin, tenantId } = guard.ctx;

  const { id: projectId } = await params;
  // Validate project belongs to tenant even though draws aren't project-scoped.
  const projectCheck = await resolveProject(admin, tenantId, projectId);
  if (!projectCheck.ok) return projectCheck.res;

  const parsed = BodySchema.safeParse(guard.body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { draws, options } = parsed.data;
  const dryRun = options?.dry_run ?? false;

  if (dryRun) {
    return NextResponse.json(dryRunEnvelope('draws', draws, draws.length));
  }

  const rows = draws.map((d) => ({
    tenant_id: tenantId,
    paid_at: d.date,
    amount_cents: d.amount_cents,
    draw_type: d.draw_type,
    note: d.label.trim(),
    import_source_row_id: d.source_row_id,
  }));

  const { data, error } = await admin
    .from('owner_draws')
    .upsert(rows, { onConflict: 'tenant_id,import_source_row_id', ignoreDuplicates: false })
    .select('id');

  if (error) {
    console.error('[import/draws] insert failed', error.message);
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  await admin.from('worklog_entries').insert({
    tenant_id: tenantId,
    entry_type: 'system',
    title: 'Owner draws imported',
    body: `${data?.length ?? 0} owner draw${data?.length === 1 ? '' : 's'} imported (context: project ${projectId}).`,
    related_type: 'project',
    related_id: projectId,
  });

  return NextResponse.json({ ok: true, count: data?.length ?? 0 });
}
