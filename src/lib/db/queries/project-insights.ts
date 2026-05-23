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
 * Consumed by `HenryInsightStrip` on the Overview tab. The per-tab nav
 * badges (`getProjectTabAlerts`) currently compute independently; unifying
 * them onto this set so the counts can't drift is a tracked follow-up
 * (see docs/ux/briefs/overview.md §"Alert-surfacing model"). `owningTab`
 * is seeded here to make that bucketing trivial.
 *
 * Not yet wired (sources not available):
 *   - `ready_to_bill` — needs a "next available draw" signal beyond
 *     `getProjectDrawSummary` (which only sums sent/paid draws).
 */

import { isOverdue } from '@/lib/invoices/ar';
import { formatCurrency } from '@/lib/pricing/calculator';
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
 */
export async function getProjectInsights(projectId: string): Promise<ProjectInsight[]> {
  const supabase = await createClient();

  const [variance, diff, budget, slip, overdueDraws, unpaidBills, unread] = await Promise.all([
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

  // 7. Unpaid vendor bills on the Spend tab.
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

  // 8. Sections substantially under budget and mostly spent — a positive
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

  // 9. All-on-track fallback — a single calm line so the strip never
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
