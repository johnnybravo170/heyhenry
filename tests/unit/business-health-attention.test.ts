/**
 * Business Health attention engine — deterministic rule coverage.
 *
 * The engine is the meatier, money-side mirror of the project Overview
 * "Needs You" aggregator. It must:
 *   - emit the overdue-AR chase only when there are 30d+ invoices, with the
 *     customer "why" itemised and capped (+N more);
 *   - emit the net-cash-negative row only when collectible near-term AR
 *     trails unpaid bills (and bills exist);
 *   - stay calm: return [] when nothing's pressing (the strip is then hidden).
 */

import { describe, expect, it } from 'vitest';
import { getBusinessHealthAttention } from '@/lib/db/queries/business-health-attention';
import type { BusinessHealthCockpit } from '@/lib/db/queries/business-health-cockpit';

function cockpit(overrides: Partial<BusinessHealthCockpit> = {}): BusinessHealthCockpit {
  return {
    ar_aging: {
      current: { total_cents: 0, count: 0 },
      late_1_30: { total_cents: 0, count: 0 },
      late_30_plus: { total_cents: 0, count: 0 },
      oldest_age_days: null,
    },
    overdue_30_plus: { invoices: [], more: 0, total_cents: 0, count: 0 },
    cash_series: [],
    near_term_cash: { bills_due_cents: 0, ar_landing_cents: 0, net_cents: 0 },
    ...overrides,
  };
}

describe('getBusinessHealthAttention', () => {
  it('returns [] when nothing is pressing (calm — strip hidden)', () => {
    expect(getBusinessHealthAttention(cockpit())).toEqual([]);
  });

  it('emits the overdue-AR chase with itemised customer "why"', () => {
    const items = getBusinessHealthAttention(
      cockpit({
        overdue_30_plus: {
          invoices: [
            { id: 'a', customer_name: 'Patel Family', total_cents: 400_000, age_days: 47 },
            { id: 'b', customer_name: 'Lin Family', total_cents: 250_000, age_days: 38 },
            { id: 'c', customer_name: 'MacLeod', total_cents: 151_600, age_days: 32 },
          ],
          more: 0,
          total_cents: 801_600,
          count: 3,
        },
      }),
    );

    expect(items).toHaveLength(1);
    const chase = items[0];
    expect(chase.kind).toBe('overdue_ar');
    expect(chase.message).toBe('3 invoices overdue >30d');
    expect(chase.why).toBe('Patel Family (47d), Lin Family (38d), MacLeod (32d)');
    expect(chase.amount_cents).toBe(801_600);
    expect(chase.is_send).toBe(true);
    expect(chase.tone).toBe('danger');
  });

  it('appends "+N more" to the chase why when overdue list is capped', () => {
    const items = getBusinessHealthAttention(
      cockpit({
        overdue_30_plus: {
          invoices: [
            { id: 'a', customer_name: 'Patel', total_cents: 100_000, age_days: 50 },
            { id: 'b', customer_name: 'Lin', total_cents: 100_000, age_days: 40 },
            { id: 'c', customer_name: 'MacLeod', total_cents: 100_000, age_days: 33 },
          ],
          more: 2,
          total_cents: 500_000,
          count: 5,
        },
      }),
    );
    expect(items[0]?.why).toBe('Patel (50d), Lin (40d), MacLeod (33d), +2 more');
    expect(items[0]?.message).toBe('5 invoices overdue >30d');
  });

  it('emits net-cash-negative when bills outweigh collectible near-term AR', () => {
    const items = getBusinessHealthAttention(
      cockpit({
        near_term_cash: {
          bills_due_cents: 1_420_000,
          ar_landing_cents: 1_140_000,
          net_cents: -280_000,
        },
      }),
    );
    expect(items).toHaveLength(1);
    const cash = items[0];
    expect(cash.kind).toBe('cash_negative');
    expect(cash.signed).toBe(true);
    expect(cash.amount_cents).toBe(-280_000);
    expect(cash.tone).toBe('warning');
  });

  it('does NOT emit cash-negative when there are no unpaid bills', () => {
    // net < 0 only because AR landing is also 0 — no bills means nothing to act on.
    const items = getBusinessHealthAttention(
      cockpit({
        near_term_cash: { bills_due_cents: 0, ar_landing_cents: 0, net_cents: 0 },
      }),
    );
    expect(items).toEqual([]);
  });

  it('ranks the overdue chase above the cash-negative row', () => {
    const items = getBusinessHealthAttention(
      cockpit({
        overdue_30_plus: {
          invoices: [{ id: 'a', customer_name: 'Patel', total_cents: 100_000, age_days: 45 }],
          more: 0,
          total_cents: 100_000,
          count: 1,
        },
        near_term_cash: {
          bills_due_cents: 500_000,
          ar_landing_cents: 100_000,
          net_cents: -400_000,
        },
      }),
    );
    expect(items.map((i) => i.kind)).toEqual(['overdue_ar', 'cash_negative']);
  });
});
