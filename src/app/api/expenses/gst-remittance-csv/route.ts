/**
 * CSV export for the GST/HST remittance report.
 *
 * Matches what the on-screen report shows:
 *   - Header rows with collected / ITC / net
 *   - Per-category breakdown of ITC on expenses
 *   - Single-line summary of bill-side ITC
 *
 * Shape chosen to be bookkeeper-friendly: each section has a label row
 * so when they open it in Excel/Sheets the layout is self-explanatory.
 */

import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/helpers';
import { getGstRemittanceReport, type RemittancePeriod } from '@/lib/db/queries/gst-remittance';

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseDate(v: string | null): string | null {
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function GET(req: Request) {
  const { tenant } = await requireTenant();
  if (tenant.member.role === 'worker') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = parseDate(url.searchParams.get('from'));
  const to = parseDate(url.searchParams.get('to'));
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required (YYYY-MM-DD)' }, { status: 400 });
  }

  const period: RemittancePeriod = { from, to };
  const report = await getGstRemittanceReport(tenant.id, period);

  const rows: string[] = [];
  const push = (cols: (string | number)[]) =>
    rows.push(cols.map((c) => csvEscape(String(c))).join(','));

  push(['GST/HST remittance report']);
  push(['Period', `${from} to ${to}`]);
  push(['Tenant', tenant.name]);
  push([]);

  push(['Summary']);
  push(['Category', 'Pre-tax subtotal', 'GST/HST']);
  push([
    'Collected on paid invoices',
    formatCents(report.collected.amount_cents),
    formatCents(report.collected.tax_cents),
  ]);
  push([
    'Paid on expenses',
    formatCents(report.paid_on_expenses.amount_cents),
    formatCents(report.paid_on_expenses.tax_cents),
  ]);
  push([
    'Paid on bills',
    formatCents(report.paid_on_bills.amount_cents),
    formatCents(report.paid_on_bills.tax_cents),
  ]);
  push(['Net owed to CRA', '', formatCents(report.net_owed_cents)]);
  push([]);

  push(['ITC breakdown by expense category']);
  push(['Category', 'Pre-tax subtotal', 'GST/HST (ITC)']);
  for (const line of report.paid_on_expenses.by_category) {
    push([line.category_label, formatCents(line.amount_cents), formatCents(line.tax_cents)]);
  }

  const csv = rows.join('\n');
  const filename = `gst-remittance-${from}-to-${to}.csv`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
