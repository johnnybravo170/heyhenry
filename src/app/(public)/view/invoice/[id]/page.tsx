import type { Metadata } from 'next';
import {
  type InteracDetails,
  InvoicePayZone,
} from '@/components/features/invoices/invoice-pay-zone';
import {
  type CustomerDocStatus,
  type CustomerDocTotalsRow,
  CustomerDocument,
} from '@/components/features/projects/customer-document';
import { PublicViewLogger } from '@/components/features/public/public-view-logger';
import { formatDate } from '@/lib/date/format';
import { formatCurrency } from '@/lib/pricing/calculator';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Your Invoice',
  robots: { index: false, follow: false },
};

const LOGO_SIGN_SECONDS = 60 * 60 * 24 * 30;

type LineItem = {
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

/** Pull the first email-looking token out of the GC's free-text payment
 *  instructions so the Interac block can show a structured "Send to" field.
 *  There's no dedicated tenant e-Transfer column — the operator configures
 *  it inside invoice_payment_instructions today. */
function extractEtransferEmail(instructions: string | null): string | null {
  if (!instructions) return null;
  const m = instructions.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m?.[0] ?? null;
}

export default async function PublicInvoiceViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // The route segment is still named `[id]` but now resolves by the public
  // `code` first, then falls back to the raw id — so existing id-based links
  // a customer already holds keep working while new sends use the code.
  const { id: codeOrId } = await params;
  const supabase = createAdminClient();

  const SELECT =
    'id, code, tenant_id, customer_id, status, doc_type, tax_inclusive, percent_complete, amount_cents, tax_cents, line_items, customer_note, pdf_url, sent_at, paid_at, created_at, payment_instructions_override, terms_override, policies_override, payment_method';

  let { data: invoice } = await supabase
    .from('invoices')
    .select(SELECT)
    .eq('code', codeOrId)
    .is('deleted_at', null)
    .maybeSingle();

  // Legacy fallback: raw-UUID-keyed links. UUID shape guard avoids a wasted
  // round-trip for code-shaped params.
  if (!invoice && /^[0-9a-f-]{36}$/i.test(codeOrId)) {
    ({ data: invoice } = await supabase
      .from('invoices')
      .select(SELECT)
      .eq('id', codeOrId)
      .is('deleted_at', null)
      .maybeSingle());
  }

  if (!invoice || invoice.status === 'draft') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Invoice not available</h1>
          <p className="mt-2 text-muted-foreground">
            This invoice is no longer available or has not been sent yet.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: tenant }, { data: customer }] = await Promise.all([
    supabase
      .from('tenants')
      .select(
        'name, logo_storage_path, gst_number, wcb_number, invoice_payment_instructions, invoice_terms, invoice_policies, timezone',
      )
      .eq('id', invoice.tenant_id)
      .single(),
    supabase
      .from('customers')
      .select('name, email, phone, address_line1, city, province, postal_code')
      .eq('id', invoice.customer_id)
      .single(),
  ]);

  // Sign the GC logo (private photos bucket) — the invoice now carries the
  // brand the same way the estimate does.
  let logoUrl: string | null = null;
  const logoPath = (tenant?.logo_storage_path as string | null) ?? null;
  if (logoPath) {
    const { data: signed } = await supabase.storage
      .from('photos')
      .createSignedUrl(logoPath, LOGO_SIGN_SECONDS);
    logoUrl = signed?.signedUrl ?? null;
  }

  const businessName = tenant?.name ?? 'Our Company';
  const gstNumber = (tenant?.gst_number as string | null) ?? null;
  const wcbNumber = (tenant?.wcb_number as string | null) ?? null;

  const { resolveInvoiceDocFields } = await import('@/lib/invoices/default-doc-fields');
  const resolvedDocs = resolveInvoiceDocFields({
    override: {
      payment_instructions: (invoice.payment_instructions_override as string | null) ?? null,
      terms: (invoice.terms_override as string | null) ?? null,
      policies: (invoice.policies_override as string | null) ?? null,
    },
    tenant: {
      payment_instructions: (tenant?.invoice_payment_instructions as string | null) ?? null,
      terms: (tenant?.invoice_terms as string | null) ?? null,
      policies: (tenant?.invoice_policies as string | null) ?? null,
    },
  });

  const lineItems = ((invoice.line_items as LineItem[] | null) ?? []) as LineItem[];
  const lineItemsTotal = lineItems.reduce((sum, li) => sum + li.total_cents, 0);

  // tax_inclusive (draws): amount_cents IS the customer total; line_items
  // (when present) are a breakdown summing to it; tax_cents is the embedded
  // GST. Otherwise (tax_exclusive): line_items are additive on top.
  const taxInclusive = Boolean(invoice.tax_inclusive);
  const subtotalCents = taxInclusive
    ? invoice.amount_cents - invoice.tax_cents
    : invoice.amount_cents + lineItemsTotal;
  const totalCents = taxInclusive ? invoice.amount_cents : subtotalCents + invoice.tax_cents;
  const showSubtotalRow = !(taxInclusive && lineItems.length > 0);

  // Province-aware GST/HST: prefer the customer-facing tax context (PST
  // stripped — renovation contractors absorb provincial sales tax), and
  // label it with the province's real summary (GST 5% / HST 13% / …) plus
  // the BC-style province + inclusive/on-top meta. We back-compute the rate
  // from the stored tax for the rare legacy row whose tenant has no province.
  let taxRowLabel = `GST (${taxInclusive ? 'included' : 'on top'})`;
  let taxMeta: string | undefined;
  try {
    const { canadianTax } = await import('@/lib/providers/tax/canadian');
    const ctx = await canadianTax.getCustomerFacingContext(invoice.tenant_id);
    taxRowLabel = ctx.summaryLabel; // e.g. "GST 5%" / "HST 13%"
    taxMeta = [ctx.provinceCode, taxInclusive ? 'included' : 'on top'].filter(Boolean).join(' · ');
  } catch {
    const ratePct = subtotalCents > 0 ? Math.round((invoice.tax_cents / subtotalCents) * 100) : 5;
    taxRowLabel = `GST ${ratePct}%`;
    taxMeta = taxInclusive ? 'included' : 'on top';
  }

  const tenantTz = (tenant?.timezone as string | null) ?? undefined;
  const invoiceDate = formatDate(invoice.sent_at ?? invoice.created_at, {
    timezone: tenantTz,
    style: 'long',
  });

  const isPaid = invoice.status === 'paid';
  const isVoid = invoice.status === 'void';
  const isSent = invoice.status === 'sent';
  const paymentUrl = (invoice.pdf_url as string | null) ?? null;
  const isDraw = invoice.doc_type === 'draw';
  const docLabel = isDraw ? 'Draw · invoice' : 'Invoice';
  const percentComplete = (invoice.percent_complete as number | null) ?? null;
  // Friendly, non-id doc number: short uppercased code (not the raw UUID).
  const docNumber = `INV-${String(invoice.code ?? invoice.id)
    .slice(0, 8)
    .toUpperCase()}`;

  const status: CustomerDocStatus = isPaid
    ? { label: 'Paid', tone: 'success' }
    : isVoid
      ? { label: 'Void', tone: 'neutral' }
      : { label: isDraw ? 'Due now' : 'Sent', tone: 'info' };

  const customerAddress = customer
    ? [
        customer.address_line1,
        [customer.city, customer.province].filter(Boolean).join(', '),
        customer.postal_code,
      ]
        .filter(Boolean)
        .join('\n') || null
    : null;

  // Totals rows for the shell's unifying block. Draws bill a single progress
  // line (no mgmt-fee breakdown — it's baked into the contract); the shell
  // still shows Subtotal → tax → Total in the same shape as the estimate.
  const totalsRows: CustomerDocTotalsRow[] = [];
  if (showSubtotalRow) totalsRows.push({ label: 'Subtotal', cents: subtotalCents });
  for (const li of lineItems) {
    totalsRows.push({
      label: `${li.description}${li.quantity > 1 ? ` (×${li.quantity})` : ''}`,
      cents: li.total_cents,
    });
  }
  if (invoice.tax_cents > 0) {
    totalsRows.push({ label: taxRowLabel, cents: invoice.tax_cents, meta: taxMeta });
  }

  const interac: InteracDetails = {
    recipientEmail: extractEtransferEmail(resolvedDocs.payment_instructions),
    amountLabel: `${formatCurrency(totalCents)} CAD`,
    memo: docNumber,
    instructions: resolvedDocs.payment_instructions,
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 pb-28 sm:pb-10">
      <PublicViewLogger resourceType="invoice" identifier={String(invoice.code ?? invoice.id)} />
      <CustomerDocument
        logoUrl={logoUrl}
        businessName={businessName}
        docEyebrow={docLabel}
        docNumber={docNumber}
        docDate={invoiceDate ? `Sent ${invoiceDate}` : null}
        status={status}
        preparedForLabel="Billed to"
        customerName={customer?.name ?? 'Customer'}
        customerAddress={customerAddress}
        projectName={isDraw && percentComplete !== null ? `${percentComplete}% complete` : null}
        projectLabel="Progress"
        totals={{ rows: totalsRows, totalCents, totalLabel: isSent ? 'Due now' : 'Total' }}
        termsText={isSent ? null : (resolvedDocs.terms ?? null)}
        gstNumber={gstNumber}
        wcbNumber={wcbNumber}
        footerNote="Payable in CAD"
        actionZone={
          isSent ? (
            <InvoicePayZone
              paymentUrl={paymentUrl}
              payButtonLabel={`Pay ${formatCurrency(totalCents)} with card`}
              interac={interac}
            />
          ) : isPaid ? (
            <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-sm font-medium text-emerald-800">
                This {isDraw ? 'draw' : 'invoice'} has been paid.
                {invoice.paid_at
                  ? ` Paid ${formatDate(invoice.paid_at, { timezone: tenantTz, style: 'long' })}`
                  : ''}
                {invoice.payment_method ? ` · ${String(invoice.payment_method)}` : ''}.
              </p>
            </div>
          ) : isVoid ? (
            <div className="mt-7 rounded-xl border bg-muted/40 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                This {isDraw ? 'draw' : 'invoice'} has been voided and is no longer payable.
              </p>
            </div>
          ) : null
        }
      >
        {isDraw ? (
          <section className="mb-6 rounded-xl border bg-muted/30 px-5 py-4">
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Progress payment
            </p>
            <p className="mt-1 text-base font-semibold leading-tight">
              {percentComplete !== null ? (
                <>
                  <span className="text-brand">{percentComplete}%</span> of your contract complete
                </>
              ) : (
                'Progress payment against your accepted estimate'
              )}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Reconciled against the final invoice on completion.
            </p>
          </section>
        ) : null}

        <h2 className="mb-2.5 text-sm font-semibold">{isDraw ? 'This draw' : 'Line items'}</h2>
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[1fr_auto] gap-x-3 border-b bg-muted/50 px-4 py-2 text-sm font-medium">
            <div>Description</div>
            <div className="text-right">Total</div>
          </div>
          {lineItems.length > 0 ? (
            lineItems.map((li) => (
              <div
                key={li.description}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-b px-4 py-3 last:border-0"
              >
                <span className="text-sm">
                  {li.description}
                  {li.quantity > 1 ? ` (×${li.quantity})` : ''}
                </span>
                <span className="text-sm tabular-nums">{formatCurrency(li.total_cents)}</span>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 px-4 py-3">
              <span className="text-sm">
                {isDraw ? 'Progress payment' : `Services from ${businessName}`}
              </span>
              <span className="text-sm tabular-nums">{formatCurrency(subtotalCents)}</span>
            </div>
          )}
        </div>

        {invoice.customer_note ? (
          <section className="mt-6 rounded-md border p-4">
            <p className="mb-2 font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Note
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {invoice.customer_note as string}
            </p>
          </section>
        ) : null}
      </CustomerDocument>
    </div>
  );
}
