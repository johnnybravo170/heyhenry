/**
 * Per-tab attention counts for the Project Hub nav.
 *
 * Each primary work tab "owns" a class of project alert; this aggregator
 * buckets the live signals by owning tab so the nav can render a count
 * badge on each label (`Budget² · Spend¹ · Labour² · Billing¹`). It is
 * the same data the Overview "Needs You" strip aggregates, viewed by
 * owning tab instead of severity — see `docs/ux/briefs/project-hub.md`
 * §"Alert surfacing model".
 *
 * The badges stream into the nav in their own Suspense boundary, so this
 * never blocks the synchronous header paint. Each per-tab source is
 * wrapped so one failing signal hides only its own badge (0) rather than
 * taking down the whole strip — matching the non-fatal-count convention
 * the shell already uses for the Client unread badge.
 */

import { isOverdue } from '@/lib/invoices/ar';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getVarianceReport } from './cost-lines';
import { getUnsentDiff } from './project-scope-diff';

/** Count of attention items owned by each primary work tab. Keys match
 *  the primary tab route keys in the Project Hub shell. Overview is the
 *  aggregator (the "Needs You" strip), not an owner — it carries no badge. */
export type ProjectTabAlertCounts = {
  /** Budget = margin at risk + unsent scope changes. */
  budget: number;
  /** Spend = sub-quotes awaiting review + unpaid vendor bills. */
  costs: number;
  /** Labour = worker invoices submitted but not yet approved. */
  time: number;
  /** Schedule = crew scheduling conflicts. Deferred until the dispatch
   *  board lands (Schedule is v0 read-only per Scope Lock). */
  schedule: number;
  /** Billing = overdue customer invoices/draws. */
  invoices: number;
};

const ZERO: ProjectTabAlertCounts = {
  budget: 0,
  costs: 0,
  time: 0,
  schedule: 0,
  invoices: 0,
};

async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch {
    return 0;
  }
}

/**
 * Compute the per-tab attention counts for one project. Runs each tab's
 * light count query / reused aggregate in parallel; never throws (a
 * failing source yields a 0 for that tab only). `tenantId` is required
 * to scope the admin-client worker-invoice read (RLS is bypassed there).
 */
export async function getProjectTabAlerts(
  projectId: string,
  tenantId: string,
): Promise<ProjectTabAlertCounts> {
  const supabase = await createClient();

  const [budget, costs, time, invoices] = await Promise.all([
    // Budget — margin at risk (revenue < actual + committed) + unsent
    // scope changes since the last signed snapshot. Reuses the same
    // variance + diff the Budget tab chips and Overview strip ride, so
    // the badge count matches what's shown there.
    safeCount(async () => {
      const [variance, diff] = await Promise.all([
        getVarianceReport(projectId),
        getUnsentDiff(projectId),
      ]);
      const marginAtRisk = variance.margin_at_risk_cents < 0 ? 1 : 0;
      const unsentChanges = diff.has_baseline && diff.total_change_count > 0 ? 1 : 0;
      return marginAtRisk + unsentChanges;
    }),

    // Spend — sub-quotes awaiting operator review + unpaid vendor bills
    // (money tasks waiting on the procurement/AP surface).
    safeCount(async () => {
      const [pendingQuotes, unpaidBills] = await Promise.all([
        supabase
          .from('project_sub_quotes')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .eq('status', 'pending_review'),
        supabase
          .from('project_costs')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .eq('source_type', 'vendor_bill')
          .eq('status', 'active')
          .eq('payment_status', 'unpaid'),
      ]);
      return (pendingQuotes.count ?? 0) + (unpaidBills.count ?? 0);
    }),

    // Labour — worker invoices submitted but not yet approved. Worker
    // invoices are read via the admin client (RLS isn't wired for
    // owner-side reads), so scope explicitly by tenant + project.
    safeCount(async () => {
      const admin = createAdminClient();
      const { count } = await admin
        .from('worker_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('status', 'submitted');
      return count ?? 0;
    }),

    // Billing — overdue customer invoices/draws (sent, unpaid, >14d via
    // the canonical AR `isOverdue`). Pre-filter to sent + unpaid in SQL,
    // then apply the age threshold in JS.
    safeCount(async () => {
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
    }),
  ]);

  return {
    ...ZERO,
    budget,
    costs,
    time,
    invoices,
  };
}
