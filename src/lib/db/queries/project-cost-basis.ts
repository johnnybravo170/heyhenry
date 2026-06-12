/**
 * Project cost-basis rollup. Single source of truth for the raw cost
 * data feeding `generateFinalInvoiceAction`'s cost-plus path — and the
 * reconciliation guardrail on the draft-invoice page that catches
 * drift between today's cost data and what's already on the draft.
 *
 * Why a dedicated helper:
 *   - The action used to query `time_entries`, `expenses`, and
 *     `project_bills` inline. When `project_bills` was added (the
 *     vendor/sub-invoice path) the action's query was missed, so
 *     sub-heavy cost-plus invoices silently underbilled by the
 *     subcontractor total. The fix (#178) widened the action; this
 *     helper centralizes the queries so the next time a cost source
 *     is added there's exactly one place to wire it in.
 *   - The draft-invoice page renders a drift banner if the persisted
 *     invoice's cost basis (frozen at creation time) no longer matches
 *     today's data. The banner needs the same numbers the action
 *     produced — calling this helper guarantees it.
 *
 * As of the cost-unification rollout, both receipts and vendor bills
 * read from the unified `project_costs` table via a single query with
 * a `source_type` discriminator. The output shape (`expenseRows` +
 * `billRows`) is preserved so the cost-plus invoice action and the
 * drift banner consume identical values — receipts expose gross
 * `amount_cents` and `pre_tax_amount_cents`, bills expose pre-GST
 * `amount_cents` (re-derived from `pre_tax_amount_cents`) and
 * `gst_cents`. Same numbers, one query.
 *
 * What this helper does NOT do: apply markup, compute mgmt fee, or
 * project tax. That's `computeCostPlusBreakdown`'s job. The helper
 * returns the raw rows + the pre-tax cost-basis aggregates the
 * breakdown will produce, so callers can either re-run the breakdown
 * or compare against a previously-computed number.
 */

import { createClient } from '@/lib/supabase/server';

export type CostBasisTimeEntry = {
  hours: number;
  hourly_rate_cents: number | null;
  /** Optional — null/undefined treated as "no charge rate set, fall back to pay rate". */
  charge_rate_cents?: number | null;
};

export type CostBasisExpenseRow = {
  amount_cents: number;
  pre_tax_amount_cents: number | null;
};

export type CostBasisBillRow = {
  amount_cents: number;
  gst_cents: number;
};

export type ProjectCostBasisRollup = {
  /** Raw rows — feed straight into `computeCostPlusBreakdown`. */
  timeEntries: CostBasisTimeEntry[];
  expenseRows: CostBasisExpenseRow[];
  billRows: CostBasisBillRow[];

  /**
   * Σ hours × hourly_rate_cents — the worker's *pay* rate. Used for
   * job-cost / margin accounting only (what the GC actually pays out).
   */
  labourCents: number;
  /**
   * Σ hours × charge_rate_cents (fallback: hourly_rate_cents). The
   * customer-facing labour number that lands on the invoice line.
   * Distinct from labourCents when workers have charge rates set.
   */
  labourInvoiceCents: number;
  /** Σ pre_tax_amount_cents ?? amount_cents over expenses — the cost
   *  basis the cost-plus invoice will bill on the Materials line. */
  expensesPreTaxCents: number;
  /** Σ amount_cents over expenses — the gross paid (includes GST). */
  expensesGrossCents: number;
  /** Σ amount_cents over bills. Already pre-GST per migration 0083. */
  billsCents: number;

  /**
   * What `computeCostPlusBreakdown` will produce for
   * `labourCents + materialsCents`. Uses labourInvoiceCents (charge
   * rate) so the drift banner stays accurate when charge rates differ
   * from pay rates.
   */
  invoiceCostBasisCents: number;
};

type ProjectCostRow = {
  source_type: 'receipt' | 'vendor_bill';
  amount_cents: number;
  pre_tax_amount_cents: number | null;
  gst_cents: number;
};

/**
 * Pure aggregator — same row semantics as `computeCostPlusBreakdown`'s
 * inputs. Split out from the DB query so the math is unit-testable
 * without mocking Supabase. The query function is just a thin wrapper
 * that fetches the source data and hands rows to this.
 */
export function summarizeCostBasisRows(rows: {
  timeEntries: ReadonlyArray<CostBasisTimeEntry>;
  expenseRows: ReadonlyArray<CostBasisExpenseRow>;
  billRows: ReadonlyArray<CostBasisBillRow>;
}): ProjectCostBasisRollup {
  let labourCents = 0;
  let labourInvoiceCents = 0;
  for (const t of rows.timeEntries) {
    const hours = Number(t.hours);
    labourCents += Math.round(hours * (t.hourly_rate_cents ?? 0));
    const invoiceRate = t.charge_rate_cents ?? t.hourly_rate_cents ?? 0;
    labourInvoiceCents += Math.round(hours * invoiceRate);
  }

  let expensesPreTaxCents = 0;
  let expensesGrossCents = 0;
  for (const e of rows.expenseRows) {
    expensesPreTaxCents += e.pre_tax_amount_cents ?? e.amount_cents;
    expensesGrossCents += e.amount_cents;
  }

  let billsCents = 0;
  for (const b of rows.billRows) {
    billsCents += b.amount_cents;
  }

  return {
    timeEntries: rows.timeEntries as CostBasisTimeEntry[],
    expenseRows: rows.expenseRows as CostBasisExpenseRow[],
    billRows: rows.billRows as CostBasisBillRow[],
    labourCents,
    labourInvoiceCents,
    expensesPreTaxCents,
    expensesGrossCents,
    billsCents,
    invoiceCostBasisCents: labourInvoiceCents + expensesPreTaxCents + billsCents,
  };
}

/**
 * Split a stream of unified `project_costs` rows back into the
 * (expenseRows, billRows) shape the aggregator expects. Pulled out so
 * the splitting logic can be unit-tested independently of the DB
 * query — the call site is otherwise a one-liner.
 *
 * Receipts → expenseRows verbatim (gross `amount_cents`, nullable
 *   `pre_tax_amount_cents`).
 * Vendor bills → billRows with `amount_cents` set to the PRE-GST
 *   subtotal (read from `pre_tax_amount_cents`, which the backfill
 *   copied verbatim from `project_bills.amount_cents`). Falls back to
 *   gross `amount_cents` for legacy bills predating migration 0083's
 *   GST split.
 */
export function splitProjectCostRows(rows: ReadonlyArray<ProjectCostRow>): {
  expenseRows: CostBasisExpenseRow[];
  billRows: CostBasisBillRow[];
} {
  const expenseRows: CostBasisExpenseRow[] = [];
  const billRows: CostBasisBillRow[] = [];
  for (const c of rows) {
    if (c.source_type === 'vendor_bill') {
      billRows.push({
        amount_cents: c.pre_tax_amount_cents ?? c.amount_cents,
        gst_cents: c.gst_cents,
      });
    } else {
      expenseRows.push({
        amount_cents: c.amount_cents,
        pre_tax_amount_cents: c.pre_tax_amount_cents,
      });
    }
  }
  return { expenseRows, billRows };
}

/**
 * Pull all cost rows for a project and return them alongside the
 * pre-tax cost-basis aggregate the cost-plus invoice math will produce.
 *
 * Uses the request-scoped (RLS-aware) client. Callers in unauth contexts
 * (cron, portal) should keep using `getPortalBudgetSummary` with the
 * admin client — this helper is operator-side only.
 */
export async function getProjectCostBasisRollup(
  projectId: string,
): Promise<ProjectCostBasisRollup> {
  const supabase = await createClient();

  const [timeRes, costRes] = await Promise.all([
    supabase
      .from('time_entries')
      .select('hours, hourly_rate_cents, charge_rate_cents')
      .eq('project_id', projectId),
    // Unified read across receipts + vendor bills. status='active' mirrors
    // the legacy implicit-active behavior of `expenses` (which has no
    // status column) and the no-void state of `project_bills` (which
    // only flips to 'paid').
    //
    // is_billable = false rows are project overhead the contractor absorbs
    // (e.g. a sub's WCB bill — card #11). They MUST NOT reach the cost-plus
    // invoice base: the customer is never billed (and no markup applied)
    // for them. They still hit margin via get_project_variance_aggregates,
    // which intentionally sums every active row regardless of this flag.
    // Column is NOT NULL DEFAULT TRUE, so eq(true) cleanly excludes the
    // non-billable rows without a null-handling branch.
    supabase
      .from('project_costs')
      .select('source_type, amount_cents, pre_tax_amount_cents, gst_cents')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .eq('is_billable', true),
  ]);

  const { expenseRows, billRows } = splitProjectCostRows((costRes.data ?? []) as ProjectCostRow[]);

  return summarizeCostBasisRows({
    timeEntries: (timeRes.data ?? []) as CostBasisTimeEntry[],
    expenseRows,
    billRows,
  });
}
