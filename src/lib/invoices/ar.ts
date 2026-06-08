/**
 * Canonical, tax-aware Accounts-Receivable definition — the single source of
 * truth for "how much you're owed" and "what's overdue".
 *
 * Pure helpers, no server-only imports (mirrors `totals.ts`), so any layer —
 * server query, client component, RPC-parity test — reads the same math.
 *
 * Outstanding = a *sent*, *unpaid*, *non-deleted* invoice's full customer
 * total. The total respects `tax_inclusive` via `invoiceTotalCents` — the
 * historical AR bug was summing `amount_cents + tax_cents` unconditionally,
 * which double-counts tax on tax-inclusive invoices. Always go through this
 * helper instead of re-deriving the filter or the sum.
 *
 * Overdue = outstanding AND sent more than `AR_OVERDUE_DAYS` ago.
 */

import { invoiceTotalCents } from './totals';

/** Days after `sent_at` an unpaid invoice is considered overdue. */
export const AR_OVERDUE_DAYS = 14;

/** The minimal invoice shape AR math needs. */
export type ArInvoice = {
  status: string;
  paid_at: string | null;
  deleted_at?: string | null;
  sent_at?: string | null;
  amount_cents: number | null | undefined;
  tax_cents: number | null | undefined;
  tax_inclusive?: boolean | null | undefined;
  line_items?: { total_cents?: number | null }[] | null | undefined;
};

/** Is this invoice an outstanding receivable (sent, unpaid, not deleted)? */
export function isOutstanding(invoice: ArInvoice): boolean {
  return (
    invoice.status === 'sent' && invoice.paid_at === null && (invoice.deleted_at ?? null) === null
  );
}

/** Outstanding amount for one invoice — its tax-aware total, or 0 if settled. */
export function invoiceOutstandingCents(invoice: ArInvoice): number {
  return isOutstanding(invoice) ? invoiceTotalCents(invoice) : 0;
}

/** Is this invoice outstanding AND past the overdue threshold? */
export function isOverdue(invoice: ArInvoice, now: Date = new Date()): boolean {
  if (!isOutstanding(invoice) || !invoice.sent_at) return false;
  const sentAt = new Date(invoice.sent_at).getTime();
  if (Number.isNaN(sentAt)) return false;
  const ageDays = (now.getTime() - sentAt) / 86_400_000;
  return ageDays >= AR_OVERDUE_DAYS;
}

/** Total outstanding across a set of invoices. */
export function arOutstanding(invoices: ArInvoice[]): number {
  return invoices.reduce((sum, inv) => sum + invoiceOutstandingCents(inv), 0);
}

/** Total overdue across a set of invoices. */
export function arOverdue(invoices: ArInvoice[], now: Date = new Date()): number {
  return invoices.reduce((sum, inv) => sum + (isOverdue(inv, now) ? invoiceTotalCents(inv) : 0), 0);
}
