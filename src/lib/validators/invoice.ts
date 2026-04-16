/**
 * Zod validators for invoice forms and server actions.
 *
 * Statuses flow: draft -> sent -> paid  (or draft/sent -> void).
 *
 * See PHASE_1_PLAN.md Phase 1C.
 */

import { z } from 'zod';

export const invoiceStatuses = ['draft', 'sent', 'paid', 'void'] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  void: 'Void',
};

/**
 * Valid status transitions.
 *   draft  -> sent, void
 *   sent   -> paid, void
 *   paid   -> (terminal)
 *   void   -> (terminal)
 */
export const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'void'],
  sent: ['paid', 'void'],
  paid: [],
  void: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}

export const invoiceCreateSchema = z.object({
  job_id: z.string().uuid({ message: 'Invalid job id.' }),
  amount_cents: z
    .number()
    .int({ message: 'Amount must be a whole number of cents.' })
    .min(100, { message: 'Minimum invoice amount is $1.00.' })
    .max(10_000_000, { message: 'Amount exceeds maximum.' }),
  tax_cents: z
    .number()
    .int({ message: 'Tax must be a whole number of cents.' })
    .min(0, { message: 'Tax cannot be negative.' })
    .max(10_000_000, { message: 'Tax exceeds maximum.' }),
});

export const invoiceSendSchema = z.object({
  invoice_id: z.string().uuid({ message: 'Invalid invoice id.' }),
});

export const invoiceVoidSchema = z.object({
  invoice_id: z.string().uuid({ message: 'Invalid invoice id.' }),
});

export const invoiceMarkPaidSchema = z.object({
  invoice_id: z.string().uuid({ message: 'Invalid invoice id.' }),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceSendInput = z.infer<typeof invoiceSendSchema>;
