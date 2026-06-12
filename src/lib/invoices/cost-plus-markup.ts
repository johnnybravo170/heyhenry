/**
 * Cost-plus billing math for `generateFinalInvoiceAction` (and anywhere
 * else we need the same numbers).
 *
 * Why this lives in its own module:
 *   1. The math has subtle Canadian-tax semantics (ITC reclaim, GST not
 *      part of the cost basis) that deserve their own tests, separate
 *      from the side-effecty server action.
 *   2. The action mixes Supabase fetches, RLS, validation, and formatting
 *      with the math itself. Pulling the pure piece out makes it testable
 *      without spinning up a fake Supabase.
 *
 * What it does NOT do: query, persist, or compute GST on the client
 * invoice. That's the caller's job (see `canadianTax.getCustomerFacingContext`).
 * This module just produces the pre-tax breakdown that the GST line at
 * the bottom of the invoice gets applied to.
 */

export type CostPlusTimeEntry = {
  hours: number;
  /** Worker's pay rate — used for job-cost / margin accounting only. */
  hourly_rate_cents: number | null;
  /**
   * Customer-facing bill rate. When set, this is what appears on the
   * invoice labour line (hours × charge_rate_cents). The spread vs
   * hourly_rate_cents is the labour margin (before burden costs).
   *
   * Null on entries logged before migration 0054 or before the worker
   * had a charge rate configured. Falls back to hourly_rate_cents so
   * the invoice is never under-billed (conservative, matches prior
   * behaviour for projects that never set charge rates).
   */
  charge_rate_cents?: number | null;
};

export type CostPlusExpense = {
  amount_cents: number;
  /**
   * Receipt subtotal before GST/HST/PST. The contractor's *real* cost.
   * Markup on cost-plus invoices is applied to this — not to
   * amount_cents — because the contractor reclaims the tax as an ITC.
   *
   * Null on legacy rows (pre-migration 0207) and on manual-entry
   * expenses with no receipt breakdown. Those rows fall back to
   * amount_cents (slight over-markup, matches pre-fix behaviour).
   */
  pre_tax_amount_cents: number | null;
};

export type CostPlusBreakdown = {
  /**
   * Total labour billed — hours × charge_rate_cents (fallback:
   * hourly_rate_cents). This is the customer-facing number; internal
   * job-cost accounting uses hourly_rate_cents separately.
   */
  labourCents: number;
  /** Materials/expenses line on the invoice — billed at PRE-TAX cost.
   *  The bottom-of-invoice GST line then applies once on the full
   *  subtotal, avoiding the GST-on-GST trap. */
  materialsCents: number;
  /**
   * Management fee.
   *
   * When applyMgmtFeeToLabour=true (default):
   *   fee = (labour + materials) × mgmtRate
   *
   * When applyMgmtFeeToLabour=false (JVD model — margin baked in):
   *   fee = materials × mgmtRate only; labour is billed flat at charge rate
   */
  mgmtFeeCents: number;
  /** Cents already billed on prior draws — credited as a negative line. */
  priorBilledCents: number;
  /**
   * Number of time entries that fell back to hourly_rate_cents because
   * charge_rate_cents was null. Used to show a warning chip on the draft
   * invoice ("N entries have no charge rate — review before sending").
   */
  fallbackEntryCount: number;
};

/**
 * Compute the cost-plus invoice line breakdown.
 *
 * Worked example (the bug Mike flagged):
 *   - One $113 receipt with $13 HST → pre_tax = $100
 *   - $0 labour, 20% mgmt fee, no prior invoices
 *   - materialsCents = 10000 (pre-tax — NOT the gross 11300)
 *   - mgmtFeeCents = round(10000 × 0.20) = 2000
 *   - subtotal = 12000, then GST line at the invoice level adds 13% on
 *     top → $1560. Client total: $135.60. Correct.
 *
 * Legacy expense (no pre_tax_amount_cents):
 *   - $113 amount_cents, null pre_tax → falls back to amount_cents
 *   - materialsCents = 11300, mgmtFeeCents = round(11300 × 0.20) = 2260
 *   - Slight over-markup vs. correct. Matches pre-fix behaviour for
 *     existing invoices, no regression on already-sent ones.
 *
 * Charge-rate example (JVD model, applyMgmtFeeToLabour=false):
 *   - 10 hrs × $80/hr charge rate = $800 labour, pay rate $50/hr
 *   - $500 materials, 15% mgmt fee
 *   - labourCents = 80000 (charge rate)
 *   - mgmtFeeCents = round(50000 × 0.15) = 7500 (materials only)
 *   - Client pays $80000 + $50000 + $7500 = $137500 pre-tax
 */
export function computeCostPlusBreakdown(args: {
  timeEntries: ReadonlyArray<CostPlusTimeEntry>;
  expenses: ReadonlyArray<CostPlusExpense>;
  priorInvoices: ReadonlyArray<{ amount_cents: number }>;
  /** Decimal — e.g. 0.12 for 12%. */
  mgmtRate: number;
  /**
   * When true (default), management fee = (labour + materials) × mgmtRate.
   * When false, management fee = materials × mgmtRate only.
   * Set false when the contractor's margin is already baked into the
   * charge rate and a fee-on-top would double-count it.
   */
  applyMgmtFeeToLabour?: boolean;
}): CostPlusBreakdown {
  const applyFeeToLabour = args.applyMgmtFeeToLabour !== false; // default true

  let labourCents = 0;
  let fallbackEntryCount = 0;
  for (const t of args.timeEntries) {
    const hasChargeRate = t.charge_rate_cents != null;
    const rate = hasChargeRate ? (t.charge_rate_cents as number) : (t.hourly_rate_cents ?? 0);
    if (!hasChargeRate && t.hourly_rate_cents != null) fallbackEntryCount++;
    labourCents += Math.round(Number(t.hours) * rate);
  }

  // Materials line on the invoice = sum of contractor's REAL cost
  // (pre-tax when known, gross as fallback for legacy rows).
  const materialsCents = args.expenses.reduce(
    (s, e) => s + (e.pre_tax_amount_cents ?? e.amount_cents),
    0,
  );

  // Fee base depends on the operator's billing model.
  const feeBase = applyFeeToLabour ? labourCents + materialsCents : materialsCents;
  const mgmtFeeCents = Math.round(feeBase * args.mgmtRate);

  const priorBilledCents = args.priorInvoices.reduce((s, i) => s + i.amount_cents, 0);

  return { labourCents, materialsCents, mgmtFeeCents, priorBilledCents, fallbackEntryCount };
}
