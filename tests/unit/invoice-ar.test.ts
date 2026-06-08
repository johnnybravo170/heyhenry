/**
 * Unit tests for the canonical AR helper (`src/lib/invoices/ar.ts`).
 *
 * The historical bug this guards against: AR was computed as
 * `amount_cents + tax_cents` unconditionally, which double-counts tax on
 * tax-inclusive invoices (where amount_cents already IS the total). These
 * tests pin the tax-aware total and the sent/unpaid/non-deleted filter.
 */

import { describe, expect, it } from 'vitest';
import {
  AR_OVERDUE_DAYS,
  type ArInvoice,
  arOutstanding,
  arOverdue,
  invoiceOutstandingCents,
  isOutstanding,
  isOverdue,
} from '@/lib/invoices/ar';

const base: ArInvoice = {
  status: 'sent',
  paid_at: null,
  deleted_at: null,
  sent_at: '2026-01-01T00:00:00.000Z',
  amount_cents: 10_000,
  tax_cents: 500,
  tax_inclusive: false,
  line_items: [],
};

describe('isOutstanding', () => {
  it('counts a sent, unpaid, non-deleted invoice', () => {
    expect(isOutstanding(base)).toBe(true);
  });
  it('excludes draft / void / paid / deleted', () => {
    expect(isOutstanding({ ...base, status: 'draft' })).toBe(false);
    expect(isOutstanding({ ...base, status: 'void' })).toBe(false);
    expect(isOutstanding({ ...base, paid_at: '2026-02-01T00:00:00Z' })).toBe(false);
    expect(isOutstanding({ ...base, deleted_at: '2026-02-01T00:00:00Z' })).toBe(false);
  });
});

describe('invoiceOutstandingCents', () => {
  it('tax-exclusive: amount + line items + tax', () => {
    const inv = {
      ...base,
      amount_cents: 10_000,
      tax_cents: 500,
      line_items: [{ total_cents: 2_000 }],
    };
    expect(invoiceOutstandingCents(inv)).toBe(12_500);
  });

  it('tax-inclusive: amount IS the total (no double-count of tax)', () => {
    const inv = { ...base, tax_inclusive: true, amount_cents: 10_000, tax_cents: 500 };
    // The bug would have returned 10_500 here.
    expect(invoiceOutstandingCents(inv)).toBe(10_000);
  });

  it('returns 0 for a settled invoice', () => {
    expect(invoiceOutstandingCents({ ...base, paid_at: '2026-02-01T00:00:00Z' })).toBe(0);
  });
});

describe('isOverdue', () => {
  const now = new Date('2026-01-20T00:00:00.000Z');
  it('is overdue once past the threshold', () => {
    expect(isOverdue({ ...base, sent_at: '2026-01-01T00:00:00Z' }, now)).toBe(true);
  });
  it('is not overdue inside the threshold window', () => {
    const sent = new Date(now.getTime() - (AR_OVERDUE_DAYS - 1) * 86_400_000).toISOString();
    expect(isOverdue({ ...base, sent_at: sent }, now)).toBe(false);
  });
  it('is never overdue when not outstanding', () => {
    expect(isOverdue({ ...base, status: 'draft', sent_at: '2025-01-01T00:00:00Z' }, now)).toBe(
      false,
    );
  });
});

describe('aggregates', () => {
  it('arOutstanding sums tax-aware totals and ignores settled rows', () => {
    const invoices: ArInvoice[] = [
      base, // 10_500 (excl)
      { ...base, tax_inclusive: true, amount_cents: 5_000, tax_cents: 250 }, // 5_000
      { ...base, status: 'paid', paid_at: '2026-02-01T00:00:00Z' }, // 0
    ];
    expect(arOutstanding(invoices)).toBe(15_500);
  });

  it('arOverdue counts only the overdue subset', () => {
    const now = new Date('2026-01-20T00:00:00.000Z');
    const invoices: ArInvoice[] = [
      { ...base, sent_at: '2026-01-01T00:00:00Z' }, // overdue → 10_500
      { ...base, sent_at: '2026-01-19T00:00:00Z' }, // recent → 0
    ];
    expect(arOverdue(invoices, now)).toBe(10_500);
  });
});
