/**
 * Unit tests for the invoice Zod validators and status transition logic.
 */

import { describe, expect, it } from 'vitest';
import {
  canTransition,
  invoiceCreateSchema,
  invoiceMarkPaidSchema,
  invoiceSendSchema,
  invoiceVoidSchema,
} from '@/lib/validators/invoice';

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

  it('disallows draft -> paid (must go through sent)', () => {
    expect(canTransition('draft', 'paid')).toBe(false);
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
