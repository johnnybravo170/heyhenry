import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GstRemittancePanel } from '@/components/features/expenses/gst-remittance-panel';
import { requireTenant } from '@/lib/auth/helpers';
import {
  getGstRemittanceReport,
  gstPeriodPresets,
  type RemittancePeriod,
} from '@/lib/db/queries/gst-remittance';
import { canadianTax } from '@/lib/providers/tax/canadian';

export const metadata = {
  title: 'GST/HST remittance — HeyHenry',
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function parseDate(v: string | string[] | undefined): string | null {
  if (typeof v !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export default async function GstRemittancePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { tenant } = await requireTenant();
  if (tenant.member.role === 'worker') redirect('/w');

  const resolved = await searchParams;
  const presets = gstPeriodPresets();

  // Default to "this quarter" — the most common filing cadence.
  const defaultPeriod = presets.find((p) => p.key === 'this_quarter')?.period ?? presets[0].period;
  const from = parseDate(resolved.from) ?? defaultPeriod.from;
  const to = parseDate(resolved.to) ?? defaultPeriod.to;
  const period: RemittancePeriod = { from, to };

  const [report, taxCtx] = await Promise.all([
    getGstRemittanceReport(tenant.id, period),
    canadianTax.getContext(tenant.id).catch(() => null),
  ]);

  // Surface the province label so the operator knows which tax regime
  // the numbers are under ("HST 13%" for ON etc). Pure display — the
  // numbers themselves come from stored tax_cents, not rate math.
  const taxLabel = taxCtx?.summaryLabel ?? 'GST/HST';

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Expenses
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">GST/HST remittance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tax collected on invoices minus tax paid on expenses and bills. Hand this number (or the
          CSV) to your bookkeeper at filing time.
        </p>
      </header>

      <GstRemittancePanel
        report={report}
        presets={presets}
        activeFrom={from}
        activeTo={to}
        taxLabel={taxLabel}
      />
    </div>
  );
}
