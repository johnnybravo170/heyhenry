/**
 * Unit tests for the invoice Zod validators and status transition logic.
 */

import { describe, expect, it } from 'vitest';
import {
  canTransition,
  drawDeleteSchema,
  drawEditSchema,
  invoiceCreateSchema,
  invoiceMarkPaidSchema,
  invoiceSendSchema,
  invoiceVoidSchema,
} from '@/lib/validators/invoice';

const UUID = '11111111-2222-4333-8444-555555555555';

describe('invoiceCreateSchema', () => {
  it('accepts a valid invoice', () => {
    const parsed = invoiceCreateSchema.safeParse({
      job_id: '11111111-2222-4333-8444-555555555555',
      amount_cents: 15000,
      tax_cents: 750,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount_cents).toBe(15000);
      expect(parsed.data.tax_cents).toBe(750);
    }
  });

  it('rejects a non-UUID job_id', () => {
    const parsed = invoiceCreateSchema.safeParse({
      job_id: 'not-a-uuid',
      amount_cents: 10000,
      tax_cents: 500,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects amount below $1.00 (100 cents)', () => {
    const parsed = invoiceCreateSchema.safeParse({
      job_id: '11111111-2222-4333-8444-555555555555',
      amount_cents: 50,
      tax_cents: 3,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects negative tax', () => {
    const parsed = invoiceCreateSchema.safeParse({
      job_id: '11111111-2222-4333-8444-555555555555',
      amount_cents: 10000,
      tax_cents: -100,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects non-integer cents', () => {
    const parsed = invoiceCreateSchema.safeParse({
      job_id: '11111111-2222-4333-8444-555555555555',
      amount_cents: 100.5,
      tax_cents: 5,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects amount exceeding maximum', () => {
    const parsed = invoiceCreateSchema.safeParse({
      job_id: '11111111-2222-4333-8444-555555555555',
      amount_cents: 99_000_000,
      tax_cents: 500,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('invoiceSendSchema', () => {
  it('accepts a valid UUID', () => {
    const parsed = invoiceSendSchema.safeParse({
      invoice_id: '11111111-2222-4333-8444-555555555555',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid id', () => {
    const parsed = invoiceSendSchema.safeParse({ invoice_id: 'bad' });
    expect(parsed.success).toBe(false);
  });
});

describe('invoiceVoidSchema', () => {
  it('accepts a valid UUID', () => {
    const parsed = invoiceVoidSchema.safeParse({
      invoice_id: '11111111-2222-4333-8444-555555555555',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('invoiceMarkPaidSchema', () => {
  it('accepts a valid UUID', () => {
    const parsed = invoiceMarkPaidSchema.safeParse({
      invoice_id: '11111111-2222-4333-8444-555555555555',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('canTransition', () => {
  it('allows draft -> sent', () => {
    expect(canTransition('draft', 'sent')).toBe(true);
  });

  it('allows draft -> void', () => {
    expect(canTransition('draft', 'void')).toBe(true);
  });

  it('allows sent -> paid', () => {
    expect(canTransition('sent', 'paid')).toBe(true);
  });

  it('allows sent -> void', () => {
    expect(canTransition('sent', 'void')).toBe(true);
  });

  it('allows draft -> paid (manual out-of-band payment, no send first)', () => {
    expect(canTransition('draft', 'paid')).toBe(true);
  });

  it('disallows paid -> anything', () => {
    expect(canTransition('paid', 'draft')).toBe(false);
    expect(canTransition('paid', 'sent')).toBe(false);
    expect(canTransition('paid', 'void')).toBe(false);
  });

  it('disallows void -> anything', () => {
    expect(canTransition('void', 'draft')).toBe(false);
    expect(canTransition('void', 'sent')).toBe(false);
    expect(canTransition('void', 'paid')).toBe(false);
  });
});

describe('drawEditSchema', () => {
  it('accepts a valid draw edit', () => {
    const parsed = drawEditSchema.safeParse({
      invoice_id: UUID,
      label: 'Draw #2',
      percent_complete: 40,
      line_items: [{ description: 'Rough-in', quantity: 1, unit_price_cents: 500000 }],
    });
    expect(parsed.success).toBe(true);
  });

  it('allows a null percent_complete', () => {
    const parsed = drawEditSchema.safeParse({
      invoice_id: UUID,
      label: 'Deposit',
      percent_complete: null,
      line_items: [{ description: 'Deposit', quantity: 1, unit_price_cents: 100000 }],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an empty label', () => {
    const parsed = drawEditSchema.safeParse({
      invoice_id: UUID,
      label: '   ',
      line_items: [{ description: 'X', quantity: 1, unit_price_cents: 100 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects zero line items', () => {
    const parsed = drawEditSchema.safeParse({
      invoice_id: UUID,
      label: 'Draw',
      line_items: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a percent over 100', () => {
    const parsed = drawEditSchema.safeParse({
      invoice_id: UUID,
      label: 'Draw',
      percent_complete: 150,
      line_items: [{ description: 'X', quantity: 1, unit_price_cents: 100 }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('drawDeleteSchema', () => {
  it('accepts a valid UUID', () => {
    expect(drawDeleteSchema.safeParse({ invoice_id: UUID }).success).toBe(true);
  });

  it('rejects a bad id', () => {
    expect(drawDeleteSchema.safeParse({ invoice_id: 'nope' }).success).toBe(false);
  });
});
