'use server';

/**
 * Server action for AI-assisted scope scaffold generation.
 *
 * The operator types a description (voice/photo modes are layered on
 * later); Henry returns a sectioned scaffold of budget categories + line items
 * with no prices. Operator reviews, accepts the scaffold, and lines
 * land in the project. Same insert path as user-saved templates so
 * the snapshot/diff machinery picks up the changes automatically.
 *
 * Detail level (quick/standard/detailed) defaults from the tenant
 * preference but can be overridden per-call. See
 * `tenant_prefs.namespace='estimating'.data.detail_level`.
 *
 * Per the rollup: structure only, no prices. AI as suggester. Operator
 * never sees an auto-applied scaffold — preview-then-accept always.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { StarterTemplate } from '@/data/starter-templates/types';
import { generateScopeScaffold, type ScaffoldDetailLevel } from '@/lib/ai/scope-scaffold';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { applyScopeToProject } from '@/lib/db/queries/project-budget-categories';
import { createAdminClient } from '@/lib/supabase/admin';

export type ScaffoldGenerateResult =
  | { ok: true; scaffold: StarterTemplate }
  | { ok: false; error: string };

const generateSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10, 'Add a couple more details so Henry has something to chew on'),
  detailLevel: z.enum(['quick', 'standard', 'detailed']).optional(),
});

/**
 * Generate a scaffold from a free-form description. Returns the
 * proposed structure; the operator reviews + accepts via a separate
 * action (`applyScaffoldAction`).
 */
export async function generateScaffoldAction(
  input: Record<string, unknown>,
): Promise<ScaffoldGenerateResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  // Detail level: explicit input → tenant pref → 'standard' default.
  let detailLevel: ScaffoldDetailLevel = parsed.data.detailLevel ?? 'standard';
  if (!parsed.data.detailLevel) {
    const admin = createAdminClient();
    const { data: pref } = await admin
      .from('tenant_prefs')
      .select('data')
      .eq('tenant_id', tenant.id)
      .eq('namespace', 'estimating')
      .maybeSingle();
    const stored = (pref?.data as { detail_level?: string } | null)?.detail_level;
    if (stored === 'quick' || stored === 'standard' || stored === 'detailed') {
      detailLevel = stored;
    }
  }

  const scaffold = await generateScopeScaffold({
    description: parsed.data.description,
    detailLevel,
    vertical: tenant.vertical,
  });

  if (!scaffold) {
    return {
      ok: false,
      error:
        'Henry could not draft a scaffold from that description. Try adding a few more specifics (rooms, scope size, what work is included).',
    };
  }

  return { ok: true, scaffold };
}

const applySchema = z.object({
  projectId: z.string().uuid(),
  scaffold: z.object({
    label: z.string(),
    description: z.string().optional(),
    categories: z.array(
      z.object({
        name: z.string(),
        section: z.string(),
        description: z.string().optional(),
        lines: z.array(
          z.object({
            label: z.string(),
            category: z.enum(['material', 'labour', 'sub', 'equipment', 'overhead']),
            qty: z.number(),
            unit: z.string(),
            notes: z.string().optional(),
          }),
        ),
      }),
    ),
  }),
});

/**
 * Apply a (possibly operator-edited) scaffold to a project. Refuses
 * to merge into an existing scope — the operator must clear first.
 * Mirrors applyTemplateAction's insert behaviour.
 */
export async function applyScaffoldAction(
  input: Record<string, unknown>,
): Promise<{ ok: true; categoryCount: number; lineCount: number } | { ok: false; error: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid scaffold.' };
  }

  const { projectId, scaffold } = parsed.data;
  const admin = createAdminClient();

  const { data: project } = await admin
    .from('projects')
    .select('id, tenant_id')
    .eq('id', projectId)
    .maybeSingle();
  if (!project || project.tenant_id !== tenant.id) {
    return { ok: false, error: 'Project not found.' };
  }

  const [{ count: lineCount }, { count: categoryCount }] = await Promise.all([
    admin
      .from('project_cost_lines')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
    admin
      .from('project_budget_categories')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
  ]);
  if ((lineCount ?? 0) > 0 || (categoryCount ?? 0) > 0) {
    return {
      ok: false,
      error: 'Project already has categories or line items. Clear them first.',
    };
  }

  // Structure only — no prices. Shared insert path with intake + templates.
  const applied = await applyScopeToProject(admin, {
    tenantId: tenant.id,
    projectId,
    categories: scaffold.categories.map((b) => ({
      name: b.name,
      section: b.section,
      description: b.description ?? null,
      lines: b.lines.map((l) => ({
        label: l.label,
        category: l.category,
        qty: l.qty,
        unit: l.unit,
        notes: l.notes ?? null,
      })),
    })),
  });
  if (!applied.ok) return { ok: false, error: applied.error };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, categoryCount: applied.categoryCount, lineCount: applied.lineCount };
}
