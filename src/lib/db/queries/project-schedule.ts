/**
 * Project schedule (Gantt) queries.
 *
 * Tasks are the per-project Gantt rows. Tenant isolation runs through
 * `current_tenant_id()` in the `project_schedule_tasks` RLS policies;
 * application code never filters on `tenant_id`. Soft-deleted rows
 * (`deleted_at IS NOT NULL`) are filtered here for active-list reads —
 * audit / history queries can opt out.
 */

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type ScheduleConfidence = 'rough' | 'firm';
export type ScheduleStatus = 'planned' | 'scheduled' | 'in_progress' | 'done';
/** How planned_duration_days is interpreted — see migration schedule_working_days. */
export type ScheduleDurationBasis = 'working' | 'calendar';

export type ProjectScheduleTask = {
  id: string;
  project_id: string;
  name: string;
  trade_template_id: string | null;
  budget_category_id: string | null;
  phase_id: string | null;
  planned_start_date: string;
  planned_duration_days: number;
  /** 'working' (default for new rows) skips Sat/Sun; 'calendar' counts raw days. */
  duration_basis: ScheduleDurationBasis;
  /** Per-task override — span weekends like calendar days even under 'working'. */
  works_weekends: boolean;
  actual_start_date: string | null;
  actual_end_date: string | null;
  status: ScheduleStatus;
  confidence: ScheduleConfidence;
  client_visible: boolean;
  display_order: number;
  notes: string | null;
  /** Custom bar colour token (e.g. 'blue', 'red'). Null = use phase/trade colour. */
  bar_color: string | null;
};

const TASK_COLUMNS =
  'id, project_id, name, trade_template_id, budget_category_id, phase_id, planned_start_date, planned_duration_days, duration_basis, works_weekends, actual_start_date, actual_end_date, status, confidence, client_visible, display_order, notes, bar_color';

/** RLS-aware list of active tasks for the operator-side Gantt view. */
export const listScheduleTasksForProject = cache(
  async (projectId: string): Promise<ProjectScheduleTask[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('project_schedule_tasks')
      .select(TASK_COLUMNS)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });
    return (data ?? []) as ProjectScheduleTask[];
  },
);

/**
 * One added-scope unit a change order proposes to add to the schedule.
 * Maps to a draftable task in the inline CO→schedule prompt.
 */
export type CoScheduleScope = {
  /** Display + default task name (a budget-category name, or the CO title). */
  name: string;
  /** Net price added under this scope, in cents (for the `<Money>` read). */
  addedCents: number;
};

/**
 * An approved change order awaiting (or open to) scheduling — the source
 * for the Schedule tab's CO→schedule Henry prompt (brief touchpoint #3,
 * vault gotcha #13). Surfaces only while `schedule_suggestion_dismissed_at`
 * is null, so accepting OR dismissing stops the re-nag.
 */
export type CoScheduleSuggestion = {
  coId: string;
  title: string;
  /** Total cost impact of the CO, in cents (signed read via `<Money>`). */
  costImpactCents: number;
  /** Distinct added-scope units, one draftable task each. */
  scopes: CoScheduleScope[];
};

/**
 * Approved, not-yet-dismissed change orders for a project, resolved to
 * their added scope units so Henry can offer to draft schedule tasks.
 *
 * Scope resolution (one task per budget category — confirmed product
 * decision):
 *   - v2 (flow_version=2): group `add` + `modify_envelope` lines by their
 *     budget-category NAME (the trade bucket, e.g. "Tiling"), netting the
 *     added price. Lines with no resolvable category fall back to the
 *     line label. Dedup so three cost lines under "Tiling" yield ONE
 *     scope, not three tasks.
 *   - v1 (legacy) or no resolvable scope: a single scope named after the
 *     CO title carrying the whole cost impact.
 *
 * RLS gates both reads to the operator's tenant.
 */
export async function listCoScheduleSuggestions(
  projectId: string,
): Promise<CoScheduleSuggestion[]> {
  const supabase = await createClient();

  const { data: coRows } = await supabase
    .from('change_orders')
    .select('id, title, cost_impact_cents, flow_version')
    .eq('project_id', projectId)
    .eq('status', 'approved')
    .is('schedule_suggestion_dismissed_at', null)
    .order('approved_at', { ascending: true });

  const cos = (coRows ?? []) as Array<{
    id: string;
    title: string;
    cost_impact_cents: number;
    flow_version: number | null;
  }>;
  if (cos.length === 0) return [];

  // Pull every added line across all surfaced COs in one query, then
  // group per-CO in memory. modify_envelope (a budget bucket bump) and
  // add (a new cost line) both represent newly-added scope worth putting
  // on the schedule; modify/remove don't add a schedulable unit.
  const coIds = cos.map((c) => c.id);
  const { data: lineRows } = await supabase
    .from('change_order_lines')
    .select(
      'change_order_id, action, label, line_price_cents, budget_category:budget_category_id (name)',
    )
    .in('change_order_id', coIds)
    .in('action', ['add', 'modify_envelope']);

  type LineRow = {
    change_order_id: string;
    action: string;
    label: string | null;
    line_price_cents: number | null;
    budget_category: { name: string } | { name: string }[] | null;
  };

  // change_order_id → (scope name → added cents), insertion-ordered.
  const scopesByCo = new Map<string, Map<string, number>>();
  for (const raw of (lineRows ?? []) as LineRow[]) {
    const catRaw = raw.budget_category;
    const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
    const name = (cat?.name ?? raw.label ?? '').trim();
    if (!name) continue;
    const cents = raw.line_price_cents ?? 0;
    const inner = scopesByCo.get(raw.change_order_id) ?? new Map<string, number>();
    inner.set(name, (inner.get(name) ?? 0) + cents);
    scopesByCo.set(raw.change_order_id, inner);
  }

  return cos.map((co) => {
    const inner = scopesByCo.get(co.id);
    const scopes: CoScheduleScope[] =
      inner && inner.size > 0
        ? Array.from(inner.entries()).map(([name, addedCents]) => ({ name, addedCents }))
        : [{ name: co.title, addedCents: co.cost_impact_cents }];
    return {
      coId: co.id,
      title: co.title,
      costImpactCents: co.cost_impact_cents,
      scopes,
    };
  });
}
