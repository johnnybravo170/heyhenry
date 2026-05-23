import { describe, expect, it } from 'vitest';
import { changeOrderWhy } from '@/lib/change-orders/why-summary';
import type { ChangeOrderLineRow } from '@/lib/db/queries/change-orders';

function line(action: ChangeOrderLineRow['action']): ChangeOrderLineRow {
  return {
    id: crypto.randomUUID(),
    change_order_id: 'co',
    action,
    original_line_id: null,
    budget_category_id: null,
    category: null,
    label: 'x',
    qty: 1,
    unit: 'item',
    unit_cost_cents: 0,
    unit_price_cents: 0,
    line_cost_cents: 0,
    line_price_cents: 0,
    notes: null,
    before_snapshot: null,
  };
}

describe('changeOrderWhy', () => {
  it('prefers the operator description when present', () => {
    const why = changeOrderWhy({
      description: '  Found rot under the subfloor.  ',
      diffLines: [line('add')],
      timelineDays: 1,
    });
    expect(why.text).toBe('Found rot under the subfloor.');
    expect(why.authoredByHenry).toBe(false);
  });

  it('falls back to a deterministic line-count summary when no description', () => {
    const why = changeOrderWhy({
      description: null,
      diffLines: [line('add'), line('add'), line('modify'), line('remove')],
      timelineDays: 0,
    });
    expect(why.text).toContain('2 new items');
    expect(why.text).toContain('1 adjusted item');
    expect(why.text).toContain('1 removed item');
    expect(why.authoredByHenry).toBe(false);
  });

  it('appends the timeline impact in the fallback when positive', () => {
    const why = changeOrderWhy({
      description: '',
      diffLines: [line('add')],
      timelineDays: 2,
    });
    expect(why.text).toContain('adds about 2 days');
  });

  it('never returns empty text even with no lines and no description', () => {
    const why = changeOrderWhy({ description: null, diffLines: [], timelineDays: 0 });
    expect(why.text.length).toBeGreaterThan(0);
  });
});
