/**
 * GST/HST remittance report.
 *
 * Purpose: at filing time (monthly / quarterly / annual), a contractor
 * or their bookkeeper needs ONE screen showing:
 *   - Total GST/HST collected on invoices → how much we owe the CRA
 *   - Total GST/HST paid on expenses + bills (Input Tax Credits) →
 *     how much we get to deduct
 *   - Net owed (or refund owed to us)
 *
 * Scope decisions:
 *   - GST/HST ONLY. PST/QST are not ITC-eligible — the bookkeeper
 *     handles those separately (or not at all, depending on province).
 *   - Invoices count as "collected" when paid (status = 'paid' AND
 *     paid_at in range). Sent-but-unpaid doesn't count yet — matches
 *     CRA accrual rules most Canadian contractors use (if they're on
 *     cash-basis, we can add a toggle later).
 *   - Expenses + bills count when dated in range (expense_date /
 *     bill_date) regardless of whether the bill is marked paid.
 *   - Category breakdown on expense side so the bookkeeper can audit
 *     the ITC composition.
 *   - Tenant-scoped via admin client because bookkeeper users (future)
 *     will need access across surfaces; using RLS here makes the
 *     per-surface policies a mess.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type RemittancePeriod = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD (inclusive)
};

export type RemittanceCategoryLine = {
  category_id: string | null;
  category_label: string; // "Vehicles › Truck 1" or "Materials" or "Uncategorized"
  tax_cents: number;
  amount_cents: number; // pre-tax subtotal
};

export type GstRemittanceReport = {
  period: RemittancePeriod;
  collected: {
    invoice_count: number;
    tax_cents: number;
    amount_cents: number; // pre-tax invoice total
  };
  paid_on_expenses: {
    count: number;
    tax_cents: number;
    amount_cents: number; // pre-tax total
    by_category: RemittanceCategoryLine[];
  };
  paid_on_bills: {
    count: number;
    tax_cents: number;
    amount_cents: number;
  };
  net_owed_cents: number; // collected − ITCs (positive = you owe CRA, negative = refund)
};

export async function getGstRemittanceReport(
  tenantId: string,
  period: RemittancePeriod,
): Promise<GstRemittanceReport> {
  const admin = createAdminClient();

  const [invoicesRes, expensesRes, billsRes, categoriesRes] = await Promise.all([
    admin
      .from('invoices')
      .select('amount_cents, tax_cents')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .gte('paid_at', period.from)
      .lte('paid_at', `${period.to}T23:59:59.999Z`)
      .is('deleted_at', null),
    admin
      .from('expenses')
      .select('amount_cents, tax_cents, category_id')
      .eq('tenant_id', tenantId)
      .gte('expense_date', period.from)
      .lte('expense_date', period.to),
    admin
      .from('project_bills')
      .select('amount_cents, gst_cents')
      .eq('tenant_id', tenantId)
      .gte('bill_date', period.from)
      .lte('bill_date', period.to),
    admin
      .from('expense_categories')
      .select('id, name, parent_id, parent:parent_id (name)')
      .eq('tenant_id', tenantId),
  ]);

  if (invoicesRes.error) throw new Error(`Remittance: ${invoicesRes.error.message}`);
  if (expensesRes.error) throw new Error(`Remittance: ${expensesRes.error.message}`);
  if (billsRes.error) throw new Error(`Remittance: ${billsRes.error.message}`);
  if (categoriesRes.error) throw new Error(`Remittance: ${categoriesRes.error.message}`);

  const invoices = invoicesRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const bills = billsRes.data ?? [];
  const cats = categoriesRes.data ?? [];

  // Build category label map: "Parent › Child" or "Name" or "Uncategorized".
  const catLabel = new Map<string, string>();
  for (const c of cats) {
    const parentRaw = (c as { parent?: { name?: string } | { name?: string }[] | null }).parent;
    const parent = Array.isArray(parentRaw) ? parentRaw[0] : parentRaw;
    const name = (c.name as string) ?? '?';
    catLabel.set(c.id as string, parent?.name ? `${parent.name} › ${name}` : name);
  }

  // Sum expenses by category.
  type Bucket = { tax: number; amount: number };
  const expenseByCat = new Map<string | null, Bucket>();
  for (const e of expenses) {
    const cid = (e.category_id as string | null) ?? null;
    const current = expenseByCat.get(cid) ?? { tax: 0, amount: 0 };
    current.tax += (e.tax_cents as number) ?? 0;
    current.amount += (e.amount_cents as number) ?? 0;
    expenseByCat.set(cid, current);
  }
  const byCategory: RemittanceCategoryLine[] = Array.from(expenseByCat.entries())
    .map(([cid, b]) => ({
      category_id: cid,
      category_label: cid ? (catLabel.get(cid) ?? 'Unknown') : 'Uncategorized',
      tax_cents: b.tax,
      amount_cents: b.amount,
    }))
    .sort((a, b) => b.tax_cents - a.tax_cents);

  const collectedTax = invoices.reduce((s, i) => s + ((i.tax_cents as number) ?? 0), 0);
  const collectedAmount = invoices.reduce((s, i) => s + ((i.amount_cents as number) ?? 0), 0);

  const expensesTax = expenses.reduce((s, e) => s + ((e.tax_cents as number) ?? 0), 0);
  const expensesAmount = expenses.reduce((s, e) => s + ((e.amount_cents as number) ?? 0), 0);

  const billsTax = bills.reduce((s, b) => s + ((b.gst_cents as number) ?? 0), 0);
  const billsAmount = bills.reduce((s, b) => s + ((b.amount_cents as number) ?? 0), 0);

  return {
    period,
    collected: {
      invoice_count: invoices.length,
      tax_cents: collectedTax,
      amount_cents: collectedAmount,
    },
    paid_on_expenses: {
      count: expenses.length,
      tax_cents: expensesTax,
      amount_cents: expensesAmount,
      by_category: byCategory,
    },
    paid_on_bills: {
      count: bills.length,
      tax_cents: billsTax,
      amount_cents: billsAmount,
    },
    net_owed_cents: collectedTax - expensesTax - billsTax,
  };
}

// ============================================================================
// Period presets
// ============================================================================

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Canonical GST reporting periods. Quarters align with calendar (Jan-Mar,
 * Apr-Jun, Jul-Sep, Oct-Dec) — most Canadian contractors file this way.
 * A fiscal-year-end option can come later if a tenant asks.
 */
export function gstPeriodPresets(today: Date = new Date()): Array<{
  key: string;
  label: string;
  period: RemittancePeriod;
}> {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-11
  const q = Math.floor(m / 3);

  const monthStart = new Date(Date.UTC(y, m, 1));
  const monthEnd = new Date(Date.UTC(y, m + 1, 0));

  const prevMonthStart = new Date(Date.UTC(y, m - 1, 1));
  const prevMonthEnd = new Date(Date.UTC(y, m, 0));

  const quarterStart = new Date(Date.UTC(y, q * 3, 1));
  const quarterEnd = new Date(Date.UTC(y, q * 3 + 3, 0));

  const prevQuarter = q === 0 ? { y: y - 1, q: 3 } : { y, q: q - 1 };
  const prevQuarterStart = new Date(Date.UTC(prevQuarter.y, prevQuarter.q * 3, 1));
  const prevQuarterEnd = new Date(Date.UTC(prevQuarter.y, prevQuarter.q * 3 + 3, 0));

  const yearStart = new Date(Date.UTC(y, 0, 1));
  const yearEnd = new Date(Date.UTC(y, 11, 31));

  const prevYearStart = new Date(Date.UTC(y - 1, 0, 1));
  const prevYearEnd = new Date(Date.UTC(y - 1, 11, 31));

  return [
    {
      key: 'this_month',
      label: 'This month',
      period: { from: iso(monthStart), to: iso(monthEnd) },
    },
    {
      key: 'last_month',
      label: 'Last month',
      period: { from: iso(prevMonthStart), to: iso(prevMonthEnd) },
    },
    {
      key: 'this_quarter',
      label: `Q${q + 1} ${y}`,
      period: { from: iso(quarterStart), to: iso(quarterEnd) },
    },
    {
      key: 'last_quarter',
      label: `Q${prevQuarter.q + 1} ${prevQuarter.y}`,
      period: { from: iso(prevQuarterStart), to: iso(prevQuarterEnd) },
    },
    { key: 'this_year', label: `${y} YTD`, period: { from: iso(yearStart), to: iso(yearEnd) } },
    {
      key: 'last_year',
      label: `${y - 1}`,
      period: { from: iso(prevYearStart), to: iso(prevYearEnd) },
    },
  ];
}
