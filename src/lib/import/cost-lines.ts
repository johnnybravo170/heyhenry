/**
 * Cost-line label resolution for the import append routes. Labels are
 * matched case-insensitively and scoped to a budget category when the row
 * provides one — the same label can exist in two categories ("Rough-in"
 * lives under both Electrical and Plumbing), so a bare-label match is only
 * trusted when it's unique across the project.
 */

import type { createAdminClient } from '@/lib/supabase/admin';

export type CostLineResolver = (
  label: string,
  budgetCategoryId: string | undefined,
) => string | null;

/**
 * Loads the project's cost lines once and returns a resolver. Pass
 * `needed=false` to skip the round-trip when no row asks for line
 * attribution (the resolver then always returns null).
 */
export async function buildCostLineResolver(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  needed: boolean,
): Promise<CostLineResolver> {
  if (!needed) return () => null;

  const { data } = await admin
    .from('project_cost_lines')
    .select('id, label, budget_category_id')
    .eq('project_id', projectId);

  const byCategoryAndLabel = new Map<string, string>();
  const byLabel = new Map<string, string | 'ambiguous'>();
  for (const line of data ?? []) {
    const label = line.label.trim().toLowerCase();
    if (line.budget_category_id) {
      byCategoryAndLabel.set(`${line.budget_category_id}:${label}`, line.id);
    }
    byLabel.set(label, byLabel.has(label) ? 'ambiguous' : line.id);
  }

  return (label, budgetCategoryId) => {
    const key = label.trim().toLowerCase();
    if (budgetCategoryId) {
      return byCategoryAndLabel.get(`${budgetCategoryId}:${key}`) ?? null;
    }
    const hit = byLabel.get(key);
    return hit && hit !== 'ambiguous' ? hit : null;
  };
}
