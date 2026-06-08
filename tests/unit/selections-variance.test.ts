/**
 * Unit tests for selection allowance-vs-actual variance labelling.
 *
 * The cardinal rule under test: every variance carries a verb-bearing
 * label (never colour-only), every edge case (allowance-only / actual-only /
 * both-null) is handled, and the room/project roll-up only nets selections
 * with a comparable allowance+actual pair (a TBD actual must not read as
 * "under").
 */

import { describe, expect, it } from 'vitest';
import { rollupVariance, selectionVariance } from '@/lib/selections/variance';

describe('selectionVariance', () => {
  it('returns null when neither allowance nor actual is set', () => {
    expect(selectionVariance(null, null)).toBeNull();
  });

  it('labels allowance-only as pending, never colour-only', () => {
    const v = selectionVariance(380000, null);
    expect(v).not.toBeNull();
    expect(v?.tone).toBe('pending');
    expect(v?.label).toBe('Allowance $3,800.00 · no actual yet');
    expect(v?.isOverAllowance).toBe(false);
    expect(v?.deltaCents).toBeNull();
  });

  it('labels actual-only with no allowance set', () => {
    const v = selectionVariance(null, 61250);
    expect(v?.tone).toBe('flat');
    expect(v?.label).toBe('Cost $612.50 · no allowance set');
    expect(v?.deltaCents).toBeNull();
  });

  it('labels over-allowance with a signed verb label and flags the CO trigger', () => {
    const v = selectionVariance(380000, 500000);
    expect(v?.tone).toBe('over');
    expect(v?.label).toBe('+$1,200.00 over allowance');
    expect(v?.deltaCents).toBe(120000);
    expect(v?.isOverAllowance).toBe(true);
  });

  it('labels under-allowance with the saved amount', () => {
    const v = selectionVariance(68000, 61250);
    expect(v?.tone).toBe('under');
    expect(v?.label).toBe('$67.50 under');
    expect(v?.deltaCents).toBe(-6750);
    expect(v?.isOverAllowance).toBe(false);
  });

  it('labels an exact match as on allowance', () => {
    const v = selectionVariance(50000, 50000);
    expect(v?.tone).toBe('flat');
    expect(v?.label).toBe('On allowance');
    expect(v?.deltaCents).toBe(0);
    expect(v?.isOverAllowance).toBe(false);
  });
});

describe('rollupVariance', () => {
  it('handles an empty room as pending (no actuals priced)', () => {
    const r = rollupVariance([]);
    expect(r.netVarianceCents).toBeNull();
    expect(r.tone).toBe('pending');
    expect(r.label).toBe('Room — no actuals priced yet');
    expect(r.overCount).toBe(0);
    expect(r.selectionCount).toBe(0);
  });

  it('only nets selections with a comparable allowance+actual pair', () => {
    // One over (+$1,200), one under (−$67.50), one allowance-only (TBD —
    // must NOT count toward the net), one actual-only (no allowance — also
    // excluded from net).
    const r = rollupVariance([
      { allowance_cents: 380000, actual_cost_cents: 500000 },
      { allowance_cents: 68000, actual_cost_cents: 61250 },
      { allowance_cents: 200000, actual_cost_cents: null },
      { allowance_cents: null, actual_cost_cents: 90000 },
    ]);
    expect(r.netVarianceCents).toBe(120000 - 6750); // 113250
    expect(r.tone).toBe('over');
    expect(r.label).toBe('Room is +$1,132.50 over allowance');
    expect(r.overCount).toBe(1);
    expect(r.pricedCount).toBe(2);
    expect(r.selectionCount).toBe(4);
    // Totals sum every present figure regardless of pairing.
    expect(r.totalAllowanceCents).toBe(380000 + 68000 + 200000);
    expect(r.totalActualCents).toBe(500000 + 61250 + 90000);
  });

  it('labels a net-under room with the under verb', () => {
    const r = rollupVariance([{ allowance_cents: 100000, actual_cost_cents: 90000 }], 'Room');
    expect(r.tone).toBe('under');
    expect(r.label).toBe('Room is $100.00 under allowance');
  });

  it('uses the Project scope word for the top-level roll-up', () => {
    const r = rollupVariance([{ allowance_cents: 100000, actual_cost_cents: 130000 }], 'Project');
    expect(r.label).toBe('Project is +$300.00 over allowance');
  });

  it('labels an exactly-on-allowance room as flat', () => {
    const r = rollupVariance([{ allowance_cents: 50000, actual_cost_cents: 50000 }]);
    expect(r.tone).toBe('flat');
    expect(r.label).toBe('Room is on allowance');
  });
});
