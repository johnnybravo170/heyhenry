/**
 * Unit tests for the per-work-tab insight bucketing helper.
 *
 * This is the consistency contract behind the Project Hub badge model: the
 * Overview "Needs You" strip total and the per-tab nav badges (and the mobile
 * <select> per-option counts) all derive from ONE shared insight set so they
 * can't drift. `bucketInsightsByWorkTab` is the pure, DB-free reduction that
 * turns that set into the badge counts — so we can assert the invariant
 * without touching Supabase.
 *
 * Counting unit = issue-TYPE count: each actionable insight row owned by a
 * work tab counts as 1, and the `client` owning tab is excluded (its badge
 * is a separate unread item-count affordance).
 */

import { describe, expect, it } from 'vitest';
import {
  bucketInsightsByWorkTab,
  type ProjectInsight,
  WORK_TAB_KEYS,
} from '@/lib/db/queries/project-insights';

/** Minimal insight factory — only the fields the bucketer reads matter. */
function insight(partial: Partial<ProjectInsight>): ProjectInsight {
  return {
    kind: 'on_track',
    message: 'x',
    priority: 0,
    tone: 'neutral',
    ...partial,
  };
}

/** A representative mixed set: every work tab, a client row, and two
 *  non-owning informational rows (success / on-track). */
const SAMPLE: ProjectInsight[] = [
  insight({ kind: 'margin_at_risk', owningTab: 'budget' }),
  insight({ kind: 'unsent_changes', owningTab: 'budget' }),
  insight({ kind: 'pending_subquote', owningTab: 'costs' }),
  insight({ kind: 'unpaid_bills', owningTab: 'costs' }),
  insight({ kind: 'worker_invoice_approvals', owningTab: 'time' }),
  insight({ kind: 'schedule_slip', owningTab: 'schedule' }),
  insight({ kind: 'overdue_draw', owningTab: 'invoices' }),
  insight({ kind: 'client_message', owningTab: 'client' }),
  insight({ kind: 'section_under_budget' }),
  insight({ kind: 'on_track' }),
];

describe('bucketInsightsByWorkTab', () => {
  it('counts one per actionable work-tab insight (issue-TYPE count)', () => {
    const counts = bucketInsightsByWorkTab(SAMPLE);
    expect(counts).toEqual({ budget: 2, costs: 2, time: 1, schedule: 1, invoices: 1 });
  });

  it('excludes the client owning tab from work-tab buckets', () => {
    const counts = bucketInsightsByWorkTab([
      insight({ kind: 'client_message', owningTab: 'client' }),
    ]);
    expect(counts).toEqual({ budget: 0, costs: 0, time: 0, schedule: 0, invoices: 0 });
  });

  it('ignores informational rows with no owning tab', () => {
    const counts = bucketInsightsByWorkTab([
      insight({ kind: 'section_under_budget' }),
      insight({ kind: 'on_track' }),
    ]);
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });

  it('the work-tab badge sum equals the number of actionable work-tab insights', () => {
    const counts = bucketInsightsByWorkTab(SAMPLE);
    const badgeSum = WORK_TAB_KEYS.reduce((acc, key) => acc + counts[key], 0);
    // The consistency contract: badges over the 5 work tabs sum to exactly
    // the actionable insights owned by a work tab (i.e. actionable rows
    // minus the single client row), so the strip and badges stay congruent.
    const actionableWorkTabRows = SAMPLE.filter(
      (i) => i.owningTab && i.owningTab !== 'client',
    ).length;
    expect(badgeSum).toBe(actionableWorkTabRows);
  });

  it('returns an all-zero set for an empty insight list', () => {
    expect(bucketInsightsByWorkTab([])).toEqual({
      budget: 0,
      costs: 0,
      time: 0,
      schedule: 0,
      invoices: 0,
    });
  });
});
