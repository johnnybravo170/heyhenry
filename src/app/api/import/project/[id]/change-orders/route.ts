/**
 * POST /api/import/project/:id/change-orders
 * Import historical change orders and their budget diffs.
 *
 * Auth: Bearer HEYHENRY_IMPORT_TOKEN, service-role admin client.
 *
 * For approved COs the diff is applied to the project budget via
 * applyV2ChangeOrderDiff — the same primitive the live flow uses.
 * Draft/declined COs are created but not applied.
 *
 * changed/removed diff lines require resolving the original project_cost_lines
 * row by label. Unresolvable lines are returned as warnings and skipped from
 * the diff (the CO is still created without them).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardImportRequest, resolveProject } from '@/lib/import/auth';
import { dryRunEnvelope, FORBIDDEN_LINE_LABEL, zodErrorResponse } from '@/lib/import/helpers';
import { resolveTenantOwnerMemberId } from '@/lib/import/members';
import { applyV2ChangeOrderDiff } from '@/server/actions/change-orders';

const DiffLineSchema = z.object({
  category: z.enum(['material', 'labour', 'sub', 'equipment', 'overhead']).optional(),
  label: z.string().min(1),
  estimated_amount_cents: z.number().int().min(0),
  budget_category_id: z.string().uuid().optional(),
});

const ChangeOrderSchema = z.object({
  source_row_id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['draft', 'sent', 'approved', 'declined']),
  approved_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  diff: z.object({
    added: z.array(DiffLineSchema).optional().default([]),
    changed: z.array(DiffLineSchema).optional().default([]),
    removed: z.array(DiffLineSchema).optional().default([]),
  }),
});

const BodySchema = z.object({
  tenant_id: z.string().uuid(),
  change_orders: z.array(ChangeOrderSchema).min(1),
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

  const { change_orders, options } = parsed.data;
  const dryRun = options?.dry_run ?? false;

  // Validate FORBIDDEN_LINE_LABEL on all diff labels.
  for (const co of change_orders) {
    const allLines = [...co.diff.added, ...co.diff.changed, ...co.diff.removed];
    for (const line of allLines) {
      if (FORBIDDEN_LINE_LABEL.test(line.label)) {
        return NextResponse.json(
          {
            error: 'validation',
            issues: [
              {
                message: `diff label "${line.label}" looks like a fee/tax — use project management_fee_rate instead`,
                path: 'diff.label',
              },
            ],
          },
          { status: 422 },
        );
      }
    }
  }

  if (dryRun) {
    return NextResponse.json(dryRunEnvelope('change_orders', change_orders, change_orders.length));
  }

  // Look up the tenant owner member id — used as created_by (NOT NULL on change_orders).
  const ownerMemberId = await resolveTenantOwnerMemberId(admin, tenantId);
  if (!ownerMemberId) {
    return NextResponse.json(
      { error: 'no_owner_member', detail: 'Cannot resolve tenant owner member for created_by' },
      { status: 500 },
    );
  }

  // Load all existing project_cost_lines for label-based resolution of changed/removed lines.
  const { data: costLines } = await admin
    .from('project_cost_lines')
    .select('id, label, budget_category_id, category')
    .eq('project_id', projectId)
    .is('deleted_at', null);

  const linesByLabel = new Map<
    string,
    { id: string; budgetCategoryId: string | null; category: string | null }
  >();
  for (const line of costLines ?? []) {
    linesByLabel.set(line.label.toLowerCase(), {
      id: line.id,
      budgetCategoryId: line.budget_category_id,
      category: line.category,
    });
  }

  const results: {
    source_row_id: string;
    co_id: string;
    applied?: boolean;
    warnings?: string[];
  }[] = [];

  for (const co of change_orders) {
    const approvalCode = `import-${co.source_row_id.slice(0, 12)}`;
    const now = new Date().toISOString();
    const approvedAt =
      co.status === 'approved' && co.approved_date
        ? `${co.approved_date}T00:00:00.000Z`
        : co.status === 'approved'
          ? now
          : null;

    // Compute cost_impact_cents as sum of added + changed amounts.
    const impactCents = [
      ...co.diff.added.map((l) => l.estimated_amount_cents),
      ...co.diff.changed.map((l) => l.estimated_amount_cents),
      ...co.diff.removed.map((l) => -l.estimated_amount_cents),
    ].reduce((s, v) => s + v, 0);

    const { data: coRow, error: coErr } = await admin
      .from('change_orders')
      .upsert(
        {
          project_id: projectId,
          tenant_id: tenantId,
          title: co.title.trim(),
          description: `Imported change order: ${co.title.trim()}`,
          cost_impact_cents: impactCents,
          timeline_impact_days: 0,
          affected_budget_categories: [],
          flow_version: 2,
          status: co.status === 'sent' ? 'pending_approval' : co.status,
          approval_code: approvalCode,
          created_by: ownerMemberId,
          approved_at: approvedAt,
          import_source_row_id: co.source_row_id,
        },
        { onConflict: 'tenant_id,import_source_row_id', ignoreDuplicates: false },
      )
      .select('id')
      .single();

    if (coErr || !coRow) {
      results.push({
        source_row_id: co.source_row_id,
        co_id: '',
        warnings: [`Failed to create CO: ${coErr?.message}`],
      });
      continue;
    }

    // Build diff lines.
    const lineWarnings: string[] = [];
    const lineRows: Record<string, unknown>[] = [];

    for (const line of co.diff.added) {
      lineRows.push({
        change_order_id: coRow.id,
        tenant_id: tenantId,
        action: 'add',
        budget_category_id: line.budget_category_id ?? null,
        category: line.category ?? 'material',
        label: line.label,
        qty: 1,
        unit: 'lot',
        unit_cost_cents: line.estimated_amount_cents,
        unit_price_cents: line.estimated_amount_cents,
        line_cost_cents: line.estimated_amount_cents,
        line_price_cents: line.estimated_amount_cents,
      });
    }

    for (const line of co.diff.changed) {
      const existing = linesByLabel.get(line.label.toLowerCase());
      if (!existing) {
        lineWarnings.push(`changed line "${line.label}" not found in project cost lines — skipped`);
        continue;
      }
      lineRows.push({
        change_order_id: coRow.id,
        tenant_id: tenantId,
        action: 'modify',
        original_line_id: existing.id,
        budget_category_id: line.budget_category_id ?? existing.budgetCategoryId,
        category: line.category ?? existing.category ?? 'material',
        label: line.label,
        qty: 1,
        unit: 'lot',
        unit_cost_cents: line.estimated_amount_cents,
        unit_price_cents: line.estimated_amount_cents,
        line_cost_cents: line.estimated_amount_cents,
        line_price_cents: line.estimated_amount_cents,
        before_snapshot: { label: line.label, unit_cost_cents: existing.budgetCategoryId },
      });
    }

    for (const line of co.diff.removed) {
      const existing = linesByLabel.get(line.label.toLowerCase());
      if (!existing) {
        lineWarnings.push(`removed line "${line.label}" not found in project cost lines — skipped`);
        continue;
      }
      lineRows.push({
        change_order_id: coRow.id,
        tenant_id: tenantId,
        action: 'remove',
        original_line_id: existing.id,
        label: line.label,
        before_snapshot: { label: line.label, line_cost_cents: line.estimated_amount_cents },
      });
    }

    if (lineRows.length > 0) {
      const { error: linesErr } = await admin.from('change_order_lines').insert(lineRows);
      if (linesErr) {
        lineWarnings.push(`Failed to insert diff lines: ${linesErr.message}`);
      }
    }

    // Apply diff to budget for approved COs.
    let applied = false;
    if (co.status === 'approved' && lineRows.length > 0) {
      const applyResult = await applyV2ChangeOrderDiff(admin, coRow.id);
      applied = applyResult.applied;
      if (applyResult.warnings.length > 0) {
        lineWarnings.push(...applyResult.warnings.map((w) => w.message));
      }
    }

    results.push({
      source_row_id: co.source_row_id,
      co_id: coRow.id,
      applied,
      warnings: lineWarnings,
    });
  }

  await admin.from('worklog_entries').insert({
    tenant_id: tenantId,
    entry_type: 'system',
    title: 'Change orders imported',
    body: `${results.length} change order${results.length === 1 ? '' : 's'} imported for project.`,
    related_type: 'project',
    related_id: projectId,
  });

  return NextResponse.json({ ok: true, results });
}
