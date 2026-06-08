/**
 * GST display mode for draws (milestone invoices).
 *
 * DEPRECATED (EXPAND/CONTRACT): GST is now ALWAYS added on top for new
 * invoices and draws — the inclusive mode and the per-project / per-tenant
 * `draw_gst_mode` selectors were removed from the UI and write paths. This
 * module + the `invoices.tax_inclusive` and `*.draw_gst_mode` columns are
 * kept ONLY to read the legacy inclusive rows until a later "contract"
 * migration drops them. Do not wire new write paths to this.
 *
 *  - 'inclusive': the operator's entered total IS the all-in customer total;
 *    GST is embedded and backed out (incl. $X GST). Stored as
 *    tax_inclusive=true, amount_cents=total, tax_cents=embedded portion.
 *
 *  - 'on_top': the operator's entered total is the pre-tax subtotal; GST is
 *    added on top (subtotal + $X GST). Stored as tax_inclusive=false,
 *    amount_cents=0 + additive line_items, tax_cents=subtotal*rate — matching
 *    the tax-exclusive convention in invoices/totals.ts.
 *
 * Resolution order: project override → tenant default → 'inclusive'. The
 * 'inclusive' floor keeps every pre-existing project/tenant behaving exactly
 * as before; on_top is strictly opt-in.
 */
export type DrawGstMode = 'inclusive' | 'on_top';

export function isDrawGstMode(v: unknown): v is DrawGstMode {
  return v === 'inclusive' || v === 'on_top';
}

export function resolveDrawGstMode(
  projectMode: string | null | undefined,
  tenantDefault: string | null | undefined,
): DrawGstMode {
  if (isDrawGstMode(projectMode)) return projectMode;
  if (isDrawGstMode(tenantDefault)) return tenantDefault;
  return 'inclusive';
}

/** Shape of the invoicing tenant-prefs namespace (the slice we own here). */
export type InvoicingPrefs = {
  drawGstMode?: DrawGstMode;
};
