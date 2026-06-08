/**
 * Henry-supplied "Needs You" aggregator for the project Overview cockpit.
 *
 * Produces the project's actionable signals as a single severity-ranked
 * list — margin at risk, unsent scope changes, overdue draws, over-budget
 * sections, client messages, unpaid bills — plus a calm "on track" line
 * when nothing needs the operator. Each insight deep-links to the tab
 * where it's resolved (`owningTab`) and carries a CTA label.
 *
 * Rule-based v1, deterministic, no LLM in the critical path — Henry is the
 * ranking + synthesis intelligence, not a chat (decision 6790ef2b: Henry
 * surfaces things to consider, never commands). One failing source hides
 * only its own rule rather than taking down the strip.
 *
 * This is the single shared source for the Overview "Needs You" strip AND
 * the per-tab nav badges + mobile `<select>` per-option counts: the badges
 * derive from this set bucketed by `owningTab` (`getProjectTabAlerts` →
 * `bucketInsightsByWorkTab`), so the strip total and the badges can't drift
 * (see docs/ux/briefs/overview.md §"Alert-surfacing model"). Request-deduped
 * via React `cache()` so the fan-out runs once per hub load.
 *
 * Not yet wired (sources not available):
 *   - `ready_to_bill` — needs a "next available draw" signal beyond
 *     `getProjectDrawSummary` (which only sums sent/paid draws).
 */

import { cache } from 'react';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { isOverdue } from '@/lib/invoices/ar';
import { formatCurrency } from '@/lib/pricing/calculator';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getVarianceReport } from './cost-lines';
import { getBudgetVsActual } from './project-budget-categories';
import { getScheduleSlip } from './project-schedule-slip';
import { getUnsentDiff } from './project-scope-diff';

/** Visual + semantic tone. Maps onto `status-tokens.ts` in the strip;
 *  `bill` is the peach positive-action treatment (ready-to-bill / draw). */
export type InsightTone = 'danger' | 'warning' | 'bill' | 'info' | 'success' | 'neutral';

/** The primary work tab that owns (resolves) an alert. Absent = purely
 *  informational (success/on-track) — not counted toward "N today". */
export type InsightTab = 'budget' | 'costs' | 'time' | 'schedule' | 'invoices' | 'client';

export type ProjectInsight = {
  /** Stable kind for telemetry / styling. */
  kind:
    | 'margin_at_risk'
    | 'unsent_changes'
    | 'overdue_draw'
    | 'section_over_budget'
    | 'client_message'
    | 'unpaid_bills'
    | 'worker_invoice_approvals'
    | 'pending_subquote'
    | 'schedule_slip'
    | 'section_under_budget'
    | 'on_track';
  /** Operator-facing copy, plain English. */
  message: string;
  /** Optional deep link relative to the project page (e.g. `?tab=budget`). */
  href?: string;
  /** Short action label rendered on the row CTA (e.g. "Open Budget"). */
  cta?: string;
  /** Tab that resolves this alert. Absent for informational rows. */
  owningTab?: InsightTab;
  /** 0-100 — severity band; drives ordering when insights compete. */
  priority: number;
  /** Tone for visual styling. */
  tone: InsightTone;
};

/** Run a source, swallowing failure so one bad signal can't blank the
 *  whole strip. Returns `fallback` on any throw. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * Compute the project's ranked insight set. Returns ALL candidates ordered
 * by descending severity (the strip caps display at ~4 + "+N more"). When
 * nothing is actionable, returns a single calm `on_track` line.
 *
 * `cache()`-wrapped below as `getProjectInsights` — the Overview strip AND
 * the per-tab nav-badge derivation (`getProjectTabAlerts`) both consume this
 * on a single hub load, so the wrapper dedupes the whole query fan-out to one
 * computation per request rather than running every source twice.
 */
async function getProjectInsightsUncached(projectId: string): Promise<ProjectInsight[]> {
  const supabase = await createClient();
  // Worker invoices are read via the admin client (RLS isn't wired for
  // owner-side reads), so scope explicitly by tenant + project — mirrors
  // the previous independent badge logic in project-tab-alerts.
  const tenantId = (await safe(() => getCurrentTenant(), null))?.id ?? null;

  const [
    variance,
    diff,
    budget,
    slip,
    overdueDraws,
    unpaidBills,
    workerInvoiceApprovals,
    pendingSubquotes,
    unread,
  ] = await Promise.all([
    safe(() => getVarianceReport(projectId), null),
    safe(() => getUnsentDiff(projectId), null),
    safe(() => getBudgetVsActual(projectId), null),

    // Schedule slip — working-day "behind" count from the shared source so
    // this strip, the tab badge, the digest, and the Gantt agree.
    safe(() => getScheduleSlip(projectId), { behindCount: 0, behindTaskIds: [], behindTasks: [] }),

    // Overdue customer draws — sent, unpaid, aged past AR_OVERDUE_DAYS.
    // Mirrors the canonical billing-badge logic in project-tab-alerts.
    safe(async () => {
      const { data } = await supabase
        .from('invoices')
        .select('status, paid_at, deleted_at, sent_at')
        .eq('project_id', projectId)
        .eq('status', 'sent')
        .is('deleted_at', null)
        .is('paid_at', null);
      const now = new Date();
      return (data ?? []).filter((inv) => isOverdue(inv as Parameters<typeof isOverdue>[0], now))
        .length;
    }, 0),

    // Unpaid vendor bills awaiting payment on the Spend tab.
    safe(async () => {
      const { count } = await supabase
        .from('project_costs')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('source_type', 'vendor_bill')
        .eq('status', 'active')
        .eq('payment_status', 'unpaid');
      return count ?? 0;
    }, 0),

    // Worker invoices submitted but not yet approved → Labour tab. Read via
    // the admin client scoped by tenant + project (RLS isn't wired for
    // owner-side reads). 0 if the tenant couldn't be resolved.
    safe(async () => {
      if (!tenantId) return 0;
      const admin = createAdminClient();
      const { count } = await admin
        .from('worker_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('status', 'submitted');
      return count ?? 0;
    }, 0),

    // Vendor sub-quotes awaiting operator review → Spend tab.
    safe(async () => {
      const { count } = await supabase
        .from('project_sub_quotes')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'pending_review');
      return count ?? 0;
    }, 0),

    // Unread inbound client messages + idea-board items → Client tab.
    safe(async () => {
      const [msgs, ideas] = await Promise.all([
        supabase
          .from('project_messages')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .eq('direction', 'inbound')
          .is('read_by_operator_at', null),
        supabase
          .from('project_idea_board_items')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .is('read_by_operator_at', null),
      ]);
      return (msgs.count ?? 0) + (ideas.count ?? 0);
    }, 0),
  ]);

  const candidates: ProjectInsight[] = [];

  // 1. Margin at risk — THE headline cockpit signal. Revenue (scope +
  //    mgmt fee) minus actual minus committed has gone negative: the job
  //    is projected to lose money. Leads the strip in danger-soft.
  if (variance && variance.margin_at_risk_cents < 0) {
    const over = -variance.margin_at_risk_cents;
    candidates.push({
      kind: 'margin_at_risk',
      message: `Margin at risk — projected over by ${formatCurrency(over)}.`,
      href: '?tab=budget',
      cta: 'Open Budget',
      owningTab: 'budget',
      priority: 95,
      tone: 'danger',
    });
  }

  // 2. Unsent scope changes — operator has to act before customer-facing
  //    state advances.
  if (diff?.has_baseline && diff.total_change_count > 0) {
    const impacting = diff.suggested_co_count;
    const n = diff.total_change_count;
    candidates.push({
      kind: 'unsent_changes',
      message:
        impacting > 0
          ? `${n} unsent ${n === 1 ? 'change' : 'changes'} since v${diff.baseline_version} — ${impacting} customer-impacting.`
          : `${n} unsent ${n === 1 ? 'change' : 'changes'} since v${diff.baseline_version}.`,
      href: '?tab=budget&review=diff',
      cta: 'Review',
      owningTab: 'budget',
      priority: 90,
      tone: 'warning',
    });
  }

  // 3. Overdue draws — a sent draw aged past the AR threshold.
  if (overdueDraws > 0) {
    candidates.push({
      kind: 'overdue_draw',
      message: `${overdueDraws} overdue ${overdueDraws === 1 ? 'draw' : 'draws'} — past due, follow up.`,
      href: '?tab=invoices',
      cta: 'Open Billing',
      owningTab: 'invoices',
      priority: 88,
      tone: 'danger',
    });
  }

  // 4. Sections meaningfully over budget. >10% over estimate, $250 floor
  //    so tiny categories don't fire noisy messages.
  if (budget) {
    for (const line of budget.lines) {
      if (line.estimate_cents <= 0) continue;
      const ratio = line.actual_cents / line.estimate_cents;
      const delta = line.actual_cents - line.estimate_cents;
      if (ratio > 1.1 && delta > 25_000) {
        const overPct = Math.round((ratio - 1) * 100);
        candidates.push({
          kind: 'section_over_budget',
          message: `${line.budget_category_name} is ${overPct}% over budget.`,
          href: `?tab=costs&focus=${encodeURIComponent(line.budget_category_name)}`,
          cta: 'Open Spend',
          owningTab: 'costs',
          priority: 70 + Math.min(overPct, 17),
          tone: 'warning',
        });
      }
    }
  }

  // 5. Schedule slip — one or more tasks past their working-day end and
  //    not done. Shares getScheduleSlip with the tab badge + digest + Gantt
  //    so the count can't drift.
  if (slip.behindCount > 0) {
    candidates.push({
      kind: 'schedule_slip',
      message: `${slip.behindCount} ${slip.behindCount === 1 ? 'task' : 'tasks'} behind schedule.`,
      href: '?tab=schedule',
      cta: 'Open Schedule',
      owningTab: 'schedule',
      priority: 72,
      tone: 'warning',
    });
  }

  // 6. Client message / idea waiting for a reply.
  if (unread > 0) {
    candidates.push({
      kind: 'client_message',
      message: `${unread} unread ${unread === 1 ? 'message' : 'messages'} from the client.`,
      href: '?tab=client',
      cta: 'Open Client',
      owningTab: 'client',
      priority: 60,
      tone: 'info',
    });
  }

  // 7. Worker invoices awaiting approval → Labour tab.
  if (workerInvoiceApprovals > 0) {
    candidates.push({
      kind: 'worker_invoice_approvals',
      message: `${workerInvoiceApprovals} worker ${workerInvoiceApprovals === 1 ? 'invoice' : 'invoices'} to approve.`,
      href: '?tab=time',
      cta: 'Open Labour',
      owningTab: 'time',
      priority: 58,
      tone: 'warning',
    });
  }

  // 8. Vendor sub-quotes awaiting review → Spend tab.
  if (pendingSubquotes > 0) {
    candidates.push({
      kind: 'pending_subquote',
      message: `${pendingSubquotes} vendor ${pendingSubquotes === 1 ? 'quote' : 'quotes'} to review.`,
      href: '?tab=costs',
      cta: 'Open Spend',
      owningTab: 'costs',
      priority: 52,
      tone: 'info',
    });
  }

  // 9. Unpaid vendor bills on the Spend tab.
  if (unpaidBills > 0) {
    candidates.push({
      kind: 'unpaid_bills',
      message: `${unpaidBills} unpaid vendor ${unpaidBills === 1 ? 'bill' : 'bills'}.`,
      href: '?tab=costs',
      cta: 'Open Spend',
      owningTab: 'costs',
      priority: 50,
      tone: 'info',
    });
  }

  // 10. Sections substantially under budget and mostly spent — a positive
  //    "good time to lock this in" read. Informational (no owning tab).
  if (budget) {
    for (const line of budget.lines) {
      if (line.estimate_cents <= 0) continue;
      const ratio = line.actual_cents / line.estimate_cents;
      if (ratio >= 0.85 && ratio < 0.95) {
        candidates.push({
          kind: 'section_under_budget',
          message: `${line.budget_category_name} finished close to or under budget.`,
          priority: 40,
          tone: 'success',
        });
      }
    }
  }

  // 11. All-on-track fallback — a single calm line so the strip never
  //    looks "missing". Only when nothing actionable surfaced.
  const actionable = candidates.some((c) => c.owningTab);
  if (!actionable) {
    candidates.push({
      kind: 'on_track',
      message: 'On track — nothing needs you.',
      priority: 10,
      tone: 'neutral',
    });
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}

/**
 * Request-deduped insight set. The Overview strip and the per-tab nav-badge
 * derivation both call this on one hub load; `cache()` collapses them to a
 * single fan-out per request.
 */
export const getProjectInsights = cache(getProjectInsightsUncached);

/** The five primary work tabs that carry a count badge in the Project Hub
 *  nav. `client` is intentionally excluded — its badge is an unread
 *  item-count, not an issue-type count (see project-tab-alerts). */
export const WORK_TAB_KEYS = ['budget', 'costs', 'time', 'schedule', 'invoices'] as const;
export type WorkTabKey = (typeof WORK_TAB_KEYS)[number];

/**
 * Bucket an insight set into per-work-tab issue-TYPE counts: each actionable
 * insight owned by a work tab counts as 1 for that tab (an `overdue_draw`
 * row = 1 even if 2 draws are overdue). Pure + DB-free so it's unit-testable
 * and so the strip total and the badges derive from one shared set and can't
 * drift. The `client` owning tab is excluded — its badge is a separate
 * unread item-count affordance.
 */
export function bucketInsightsByWorkTab(insights: ProjectInsight[]): Record<WorkTabKey, number> {
  const counts: Record<WorkTabKey, number> = {
    budget: 0,
    costs: 0,
    time: 0,
    schedule: 0,
    invoices: 0,
  };
  for (const insight of insights) {
    const tab = insight.owningTab;
    if (tab && tab !== 'client') counts[tab] += 1;
  }
  return counts;
}
