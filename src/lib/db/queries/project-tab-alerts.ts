/**
 * Per-tab attention counts for the Project Hub nav.
 *
 * Each primary work tab "owns" a class of project alert; this aggregator
 * buckets the live signals by owning tab so the nav can render a count
 * badge on each label (`Budget² · Spend¹ · Labour² · Billing¹`). It is
 * the SAME data the Overview "Needs You" strip aggregates, viewed by
 * owning tab instead of severity — see `docs/ux/briefs/overview.md`
 * §"Alert-surfacing model".
 *
 * It derives directly from the shared `getProjectInsights` set (request-
 * deduped via React `cache()`), so the strip total, these badges, and the
 * mobile `<select>` per-option counts can't drift: a tab badge = the count
 * of distinct actionable insight rows owned by that tab (issue-TYPE count,
 * not item count). The badges stream into the nav in their own Suspense
 * boundary, so this never blocks the synchronous header paint, and the
 * insight engine's per-source `safe()` wrappers mean one failing signal
 * hides only its own row rather than taking down the whole set.
 */

import { bucketInsightsByWorkTab, getProjectInsights } from './project-insights';

/** Count of attention items owned by each primary work tab. Keys match
 *  the primary tab route keys in the Project Hub shell. Overview is the
 *  aggregator (the "Needs You" strip), not an owner — it carries no badge.
 *  Client is excluded too — its badge is a separate unread item-count. */
export type ProjectTabAlertCounts = {
  /** Budget = margin at risk + unsent scope changes. */
  budget: number;
  /** Spend = sub-quotes awaiting review + unpaid vendor bills. */
  costs: number;
  /** Labour = worker invoices submitted but not yet approved. */
  time: number;
  /** Schedule = tasks behind their working-day end (the shared slip
   *  source in `project-schedule-slip.ts`). */
  schedule: number;
  /** Billing = overdue customer invoices/draws. */
  invoices: number;
};

/**
 * Compute the per-tab attention counts for one project by bucketing the
 * shared insight set by owning tab. Never throws — `getProjectInsights`
 * wraps each source in `safe()` and the bucketing is pure.
 */
export async function getProjectTabAlerts(projectId: string): Promise<ProjectTabAlertCounts> {
  const insights = await getProjectInsights(projectId);
  return bucketInsightsByWorkTab(insights);
}
