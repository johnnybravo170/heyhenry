/**
 * Customer-facing invoice total — pure helper, no server-only imports.
 *
 * Lives outside `db/queries/invoices.ts` so client components can import
 * it without dragging `next/headers` (via `supabase/server`) into the
 * client bundle.
 *
 * Schema conventions (see also addInvoiceLineItemAction + the detail
 * page math):
 *
 *  - tax_inclusive: amount_cents IS the customer total. line_items, when
 *    present, are a breakdown summing to amount_cents (not additive).
 *    tax_cents is the embedded GST portion.
 *
 *  - tax_exclusive: line_items are additive on top of amount_cents.
 *    Total = amount_cents + sum(line_items.total_cents) + tax_cents.
 *    Estimate-derived drafts write amount_cents=0 + full breakdown
 *    in line_items; legacy invoices had amount_cents=subtotal with
 *    line_items=[] — both render correctly under amount + items + tax.
 */
type LineItem = { total_cents?: number | null };

export function invoiceTotalCents(row: {
  amount_cents: number | null | undefined;
  tax_cents: number | null | undefined;
  tax_inclusive?: boolean | null | undefined;
  line_items?: LineItem[] | null | undefined;
}): number {
  const amount = row.amount_cents ?? 0;
  const tax = row.tax_cents ?? 0;
  if (row.tax_inclusive) return amount;
  const items = (row.line_items ?? []).reduce((s, li) => s + (li?.total_cents ?? 0), 0);
  return amount + items + tax;
}

/**
 * Friendly, non-UUID invoice number. Reuses the unguessable `code`
 * (mig 20260523194840) as the secret, surfacing only its first 8 chars
 * uppercased — `INV-A1B2C3D4`. Falls back to the raw id for rows that
 * predate the backfill so the header always shows *something* stable.
 *
 * Single source of truth so the operator detail page and the public pay
 * surface (`/view/invoice/[id]`) never drift into two schemes. Pure (no
 * server imports) so client + server callers can both use it.
 */
export function invoiceDocNumber(row: { code: string | null | undefined; id: string }): string {
  return `INV-${String(row.code ?? row.id)
    .slice(0, 8)
    .toUpperCase()}`;
}
