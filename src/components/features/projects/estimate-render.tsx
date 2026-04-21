/**
 * Pure render of the customer-facing estimate. Shared between the public
 * `/estimate/[code]` page and the authed `/projects/[id]/estimate/preview`
 * page so both show the exact same thing.
 */

import { formatCurrency } from '@/lib/pricing/calculator';

export type EstimateRenderLine = {
  id: string;
  label: string;
  notes: string | null;
  qty: number;
  unit: string;
  unit_price_cents: number;
  line_price_cents: number;
  category: string;
};

export type EstimateRenderProps = {
  businessName: string;
  /** Signed URL to the tenant's logo image, or null. */
  logoUrl: string | null;
  customerName: string;
  customerAddress?: string | null;
  projectName: string;
  description: string | null;
  /** Management fee decimal (e.g. 0.12 for 12%). */
  managementFeeRate: number;
  /** GST decimal (e.g. 0.05 for 5%). Set to 0 to hide the GST row. */
  gstRate: number;
  /** Optional quote date to show in the header. ISO string. */
  quoteDate?: string | null;
  lines: EstimateRenderLine[];
  status: 'draft' | 'pending_approval' | 'approved' | 'declined';
  approvedByName?: string | null;
  approvedAt?: string | null;
  declinedReason?: string | null;
};

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function EstimateRender({
  businessName,
  logoUrl,
  customerName,
  customerAddress,
  projectName,
  description,
  managementFeeRate,
  gstRate,
  quoteDate,
  lines,
  status,
  approvedByName,
  approvedAt,
  declinedReason,
}: EstimateRenderProps) {
  const subtotal = lines.reduce((s, l) => s + l.line_price_cents, 0);
  const mgmtFee = Math.round(subtotal * managementFeeRate);
  const beforeTax = subtotal + mgmtFee;
  const gst = Math.round(beforeTax * gstRate);
  const total = beforeTax + gst;

  const dateLabel = formatDate(quoteDate) ?? formatDate(new Date().toISOString());

  return (
    <>
      {/* Branded header: logo + business name on the left, Estimate title + date on the right. */}
      <header className="mb-8 flex items-start justify-between gap-6 border-b pb-6">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            // biome-ignore lint/performance/noImgElement: signed URLs don't flow through next/image
            <img
              src={logoUrl}
              alt={`${businessName} logo`}
              className="h-12 w-auto max-w-[180px] object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{businessName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Estimate
          </p>
          {dateLabel ? <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel}</p> : null}
        </div>
      </header>

      {/* Customer + project block */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Prepared for
          </p>
          <p className="mt-1 text-sm font-medium">{customerName}</p>
          {customerAddress ? (
            <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">
              {customerAddress}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Project
          </p>
          <p className="mt-1 text-sm font-medium">{projectName}</p>
        </div>
      </div>

      {status === 'approved' && approvedByName && approvedAt ? (
        <div className="mb-6 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Approved by {approvedByName} on {formatDate(approvedAt)}.
        </div>
      ) : null}
      {status === 'declined' ? (
        <div className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          This estimate was declined.
          {declinedReason ? ` Reason: ${declinedReason}` : ''}
        </div>
      ) : null}
      {status === 'draft' ? (
        <div className="mb-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This estimate is not yet published.
        </div>
      ) : null}

      {description ? (
        <p className="mb-6 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-left font-medium">Unit</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="align-top border-b last:border-0">
                <td className="px-3 py-2">
                  <p className="font-medium">{l.label}</p>
                  {l.notes ? (
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">{l.notes}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">{Number(l.qty)}</td>
                <td className="px-3 py-2 text-muted-foreground">{l.unit}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(l.unit_price_cents)}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {formatCurrency(l.line_price_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {mgmtFee > 0 ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Management fee ({Math.round(managementFeeRate * 100)}%)
            </span>
            <span>{formatCurrency(mgmtFee)}</span>
          </div>
        ) : null}
        {gst > 0 ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              GST ({(gstRate * 100).toFixed(gstRate * 100 < 1 ? 2 : 0)}%)
            </span>
            <span>{formatCurrency(gst)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </>
  );
}
