/**
 * Business Health cockpit detail aggregates — the reads the headline RPC
 * (`get_business_health_metrics`) doesn't compute.
 *
 * `getBusinessHealthMetrics` returns the five top-line numbers (revenue, AR
 * total, AP total, owner pay, net cash). The cockpit treatment needs more:
 *   - AR **aging bands** (current / 1–30d / 30d+) — counts + tax-aware amounts
 *     that tie out to the RPC's `ar_outstanding.total_cents`.
 *   - the **overdue >30d** invoices broken out by customer (the "why" for the
 *     Henry chase row + the 30d+ band detail).
 *   - a **6-month net-cash series** for the hero mini bar chart.
 *   - a **near-term cash read** (unpaid bills vs. collectible near-term AR)
 *     for the cash-at-risk attention rule.
 *
 * All tax-aware via `invoiceTotalCents` (mirror of the SQL the RPC uses), all
 * deterministic — no forecast model, no LLM. One round-trip per source; the
 * page already runs the RPC + draws in parallel, this adds one more.
 *
 * Single-tenant owner scope (RLS-scoped via the invoker client) — no
 * cross-tenant aggregation, so no demo-tenant exclusion needed here.
 */

import { isOutstanding } from '@/lib/invoices/ar';
import { invoiceTotalCents } from '@/lib/invoices/totals';
import { createClient } from '@/lib/supabase/server';

/** Days an outstanding invoice is "current" before it counts as late. */
const AR_CURRENT_DAYS = 30;
/** Days late before an invoice falls into the 30d+ band (the chase band). */
const AR_LATE_BAND_DAYS = 60;

export type ArAgingBand = {
  total_cents: number;
  count: number;
};

export type OverdueInvoice = {
  id: string;
  customer_name: string;
  total_cents: number;
  /** Whole days since `sent_at` (or `created_at` fallback). */
  age_days: number;
};

export type CashMonthPoint = {
  /** First day of the month, ISO `YYYY-MM-01`. */
  month: string;
  /** Net cash for the month: paid-invoice revenue − receipts − owner draws. */
  net_cents: number;
};

export type BusinessHealthCockpit = {
  /** AR aging — three bands by days since sent. Amounts are tax-aware and
   *  sum to the RPC's AR total; counts sum to the RPC's AR count. */
  ar_aging: {
    current: ArAgingBand;
    late_1_30: ArAgingBand;
    late_30_plus: ArAgingBand;
    /** Oldest outstanding invoice age in days, or null when AR is empty. */
    oldest_age_days: number | null;
  };
  /** The 30d+ band, itemised by customer (newest-overdue first capped at 3
   *  for the chase "why"; `more` carries the remaining count). */
  overdue_30_plus: {
    invoices: OverdueInvoice[];
    more: number;
    total_cents: number;
    count: number;
  };
  /** Last 6 months of net cash, oldest → newest (newest = current month). */
  cash_series: CashMonthPoint[];
  /** Near-term cash read (deterministic, not a forecast):
   *  unpaid vendor bills vs. collectible near-term AR (current + 1–30d).
   *  `net_cents` negative ⇒ more owed out than likely to land soon. */
  near_term_cash: {
    bills_due_cents: number;
    ar_landing_cents: number;
    net_cents: number;
  };
};

type ArRow = {
  id: string;
  status: string;
  paid_at: string | null;
  deleted_at: string | null;
  sent_at: string | null;
  created_at: string;
  amount_cents: number | null;
  tax_cents: number | null;
  tax_inclusive: boolean | null;
  line_items: { total_cents?: number | null }[] | null;
  contacts: { name: string | null } | { name: string | null }[] | null;
};

function ageDays(row: { sent_at: string | null; created_at: string }, now: number): number {
  const ref = row.sent_at ?? row.created_at;
  const ms = now - new Date(ref).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function customerName(c: ArRow['contacts']): string {
  const rel = Array.isArray(c) ? c[0] : c;
  return rel?.name?.trim() || 'Customer';
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Cockpit detail aggregates. Run alongside `getBusinessHealthMetrics` — this
 * adds the aging breakdown, overdue itemisation, cash series, and near-term
 * cash read the headline RPC doesn't return.
 */
export async function getBusinessHealthCockpit(): Promise<BusinessHealthCockpit> {
  const supabase = await createClient();
  const now = Date.now();

  // ---- AR: all outstanding invoices, with customer name for the "why". ----
  const { data: arData, error: arError } = await supabase
    .from('invoices')
    .select(
      'id, status, paid_at, deleted_at, sent_at, created_at, amount_cents, tax_cents, tax_inclusive, line_items, contacts:contact_id (name)',
    )
    .eq('status', 'sent')
    .is('paid_at', null)
    .is('deleted_at', null);

  if (arError) {
    throw new Error(`Failed to load AR aging: ${arError.message}`);
  }

  const arRows = (arData ?? []) as unknown as ArRow[];

  const current: ArAgingBand = { total_cents: 0, count: 0 };
  const late_1_30: ArAgingBand = { total_cents: 0, count: 0 };
  const late_30_plus: ArAgingBand = { total_cents: 0, count: 0 };
  const overdueRows: OverdueInvoice[] = [];
  let oldest: number | null = null;
  let arLandingCents = 0; // current + 1–30d — the collectible near-term AR.

  for (const row of arRows) {
    if (!isOutstanding(row)) continue;
    const total = invoiceTotalCents(row);
    const age = ageDays(row, now);
    if (oldest === null || age > oldest) oldest = age;

    if (age < AR_CURRENT_DAYS) {
      current.total_cents += total;
      current.count += 1;
      arLandingCents += total;
    } else if (age < AR_LATE_BAND_DAYS) {
      late_1_30.total_cents += total;
      late_1_30.count += 1;
      arLandingCents += total;
    } else {
      late_30_plus.total_cents += total;
      late_30_plus.count += 1;
      overdueRows.push({
        id: row.id,
        customer_name: customerName(row.contacts),
        total_cents: total,
        age_days: age,
      });
    }
  }

  // Most-overdue first for the chase "why" line.
  overdueRows.sort((a, b) => b.age_days - a.age_days);
  const VISIBLE = 3;

  // ---- AP: unpaid vendor bills (matches the RPC's AP definition). ----
  const { data: apData, error: apError } = await supabase
    .from('project_costs')
    .select('amount_cents')
    .eq('source_type', 'vendor_bill')
    .eq('payment_status', 'unpaid')
    .eq('status', 'active');

  if (apError) {
    throw new Error(`Failed to load unpaid bills: ${apError.message}`);
  }
  const billsDueCents = (apData ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);

  // ---- 6-month net-cash series: paid revenue − receipts − owner draws. ----
  const seriesStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5, 1),
  );
  const seriesStartIso = monthKey(seriesStart);

  const [paidRes, receiptRes, drawRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('paid_at, amount_cents, tax_cents, tax_inclusive, line_items, status, deleted_at')
      .eq('status', 'paid')
      .is('deleted_at', null)
      .gte('paid_at', seriesStartIso),
    supabase
      .from('project_costs')
      .select('cost_date, amount_cents')
      .eq('source_type', 'receipt')
      .eq('status', 'active')
      .gte('cost_date', seriesStartIso),
    supabase.from('owner_draws').select('paid_at, amount_cents').gte('paid_at', seriesStartIso),
  ]);

  if (paidRes.error) throw new Error(`Failed to load paid invoices: ${paidRes.error.message}`);
  if (receiptRes.error) throw new Error(`Failed to load receipts: ${receiptRes.error.message}`);
  if (drawRes.error) throw new Error(`Failed to load owner draws: ${drawRes.error.message}`);

  const buckets = new Map<string, number>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(seriesStart.getUTCFullYear(), seriesStart.getUTCMonth() + i, 1));
    buckets.set(monthKey(d), 0);
  }
  const addTo = (iso: string | null, delta: number) => {
    if (!iso) return;
    const key = monthKey(new Date(iso));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + delta);
  };

  for (const inv of paidRes.data ?? []) {
    addTo(
      inv.paid_at as string | null,
      invoiceTotalCents(inv as unknown as Parameters<typeof invoiceTotalCents>[0]),
    );
  }
  for (const r of receiptRes.data ?? []) {
    addTo(r.cost_date as string | null, -(r.amount_cents ?? 0));
  }
  for (const dr of drawRes.data ?? []) {
    addTo(dr.paid_at as string | null, -(dr.amount_cents ?? 0));
  }

  const cash_series: CashMonthPoint[] = [...buckets.entries()].map(([month, net_cents]) => ({
    month,
    net_cents,
  }));

  return {
    ar_aging: {
      current,
      late_1_30,
      late_30_plus,
      oldest_age_days: oldest,
    },
    overdue_30_plus: {
      invoices: overdueRows.slice(0, VISIBLE),
      more: Math.max(0, overdueRows.length - VISIBLE),
      total_cents: late_30_plus.total_cents,
      count: late_30_plus.count,
    },
    cash_series,
    near_term_cash: {
      bills_due_cents: billsDueCents,
      ar_landing_cents: arLandingCents,
      net_cents: arLandingCents - billsDueCents,
    },
  };
}
