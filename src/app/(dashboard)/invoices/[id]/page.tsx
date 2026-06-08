import { Briefcase, CheckCircle2, Copy, Hourglass, User, XCircle } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CostBasisDriftBanner } from '@/components/features/invoices/cost-basis-drift-banner';
import { InvoiceActions } from '@/components/features/invoices/invoice-actions';
import { InvoiceDefaultsSetupBanner } from '@/components/features/invoices/invoice-defaults-setup-banner';
import { InvoiceDocumentDetails } from '@/components/features/invoices/invoice-document-details';
import { InvoiceLineItems } from '@/components/features/invoices/invoice-line-items';
import { InvoiceNote } from '@/components/features/invoices/invoice-note';
import { InvoiceOverridesEditor } from '@/components/features/invoices/invoice-overrides-editor';
import { InvoiceStatusBadge } from '@/components/features/invoices/invoice-status-badge';
import { InvoiceViewModePreview } from '@/components/features/invoices/invoice-view-mode-preview';
import { MissingGstNotice } from '@/components/features/invoices/missing-gst-notice';
import { PrintButton } from '@/components/features/shared/print-button';
import { DetailPageNav } from '@/components/layout/detail-page-nav';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { formatDateTime } from '@/lib/date/format';
import { loadInvoiceCustomerViewInputs } from '@/lib/db/queries/invoice-customer-view-inputs';
import { getInvoice } from '@/lib/db/queries/invoices';
import { getProjectCostBasisRollup } from '@/lib/db/queries/project-cost-basis';
import { invoiceDocNumber } from '@/lib/invoices/totals';
import { canadianTax } from '@/lib/providers/tax/canadian';
import { getSignedUrls } from '@/lib/storage/photos';
import { createClient } from '@/lib/supabase/server';
import { statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/lib/validators/invoice';
import { isUuid } from '@/lib/validators/uuid';
import { duplicateInvoiceAction } from '@/server/actions/invoices';

function shortId(id: string) {
  return id.slice(0, 8);
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [invoice, tenant] = await Promise.all([getInvoice(id), getCurrentTenant()]);
  if (!invoice) notFound();
  const tz = tenant?.timezone || 'America/Vancouver';
  const formatTimestamp = (iso: string | null | undefined) =>
    iso ? formatDateTime(iso, { timezone: tz }) : '';

  // Check if tenant has Stripe connected and load invoice doc defaults.
  const supabase = await createClient();
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select(
      'stripe_account_id, gst_number, wcb_number, invoice_payment_instructions, invoice_terms, invoice_policies',
    )
    .eq('id', tenant?.id ?? '')
    .maybeSingle();
  const hasStripe = !!tenantRow?.stripe_account_id;
  const gstNumber = (tenantRow?.gst_number as string | null) ?? null;
  const wcbNumber = (tenantRow?.wcb_number as string | null) ?? null;
  const docFields = {
    payment_instructions: (tenantRow?.invoice_payment_instructions as string | null) ?? null,
    terms: (tenantRow?.invoice_terms as string | null) ?? null,
    policies: (tenantRow?.invoice_policies as string | null) ?? null,
  };
  const showSetupBanner = invoice.status === 'draft' || invoice.status === 'sent';
  const regParts = [
    gstNumber ? `GST: ${gstNumber}` : null,
    wcbNumber ? `WCB: ${wcbNumber}` : null,
  ].filter(Boolean);

  // Load worklog entries for this invoice's job.
  const { data: worklog } = await supabase
    .from('worklog_entries')
    .select('id, entry_type, title, body, created_at')
    .eq('related_type', 'job')
    .eq('related_id', invoice.job_id)
    .ilike('title', '%invoice%')
    .order('created_at', { ascending: false });

  const lineItems = invoice.line_items ?? [];
  const lineItemsTotal = lineItems.reduce((sum, li) => sum + li.total_cents, 0);
  // Mirror the customer-facing public view:
  //  - tax_inclusive: amount_cents IS the customer total; line_items
  //    are a breakdown summing to it; tax_cents is embedded GST.
  //  - tax_exclusive: line_items are additive on top of amount_cents
  //    (per addInvoiceLineItemAction's contract), so subtotal sums
  //    both. New estimate-derived drafts write amount_cents=0 and
  //    everything in line_items; legacy drafts had amount_cents=full
  //    subtotal and line_items=[] until additions — both render
  //    correctly under amount + items.
  const taxInclusive = Boolean(invoice.tax_inclusive);
  const subtotalCents = taxInclusive
    ? invoice.amount_cents - invoice.tax_cents
    : invoice.amount_cents + lineItemsTotal;
  const totalCents = taxInclusive ? invoice.amount_cents : subtotalCents + invoice.tax_cents;
  const showSubtotalRow = !(taxInclusive && lineItems.length > 0);
  const taxCtx = tenant ? await canadianTax.getCustomerFacingContext(tenant.id) : null;
  const ratePct = taxCtx ? Math.round(taxCtx.totalRate * 100) : 5;
  const taxLabel = taxInclusive ? `GST (${ratePct}%, included)` : `GST (${ratePct}%)`;
  const isDraft = invoice.status === 'draft';
  // Friendly, non-UUID doc number — rides the existing `code` (mig
  // 20260523194840), the same scheme the public pay surface renders.
  const docNumber = invoiceDocNumber({ code: invoice.code, id: invoice.id });

  // "Document details" disclosure summary. Open on first paint when a
  // tenant default is blank (customer won't know how to pay) or a
  // per-invoice override is active; calm "using defaults" otherwise.
  const missingDefault = !docFields.payment_instructions || !docFields.terms || !docFields.policies;
  const overrideCount = [
    invoice.payment_instructions_override,
    invoice.terms_override,
    invoice.policies_override,
  ].filter((v) => (v ?? '').trim().length > 0).length;
  const docNeedsAttention = missingDefault || overrideCount > 0;
  const docStatusLabel = missingDefault
    ? 'Missing defaults'
    : overrideCount > 0
      ? `${overrideCount} override${overrideCount > 1 ? 's' : ''}`
      : 'Using tenant defaults';

  // Cost-basis drift check (cost-plus drafts only). The action freezes
  // labour + materials into line_items at creation; we re-roll the same
  // numbers now and compare. A non-zero delta usually means either new
  // time/expenses logged since this draft (operator should regenerate),
  // or — much rarer, and the reason this banner exists — a cost source
  // wasn't picked up by the action.
  let driftBanner: {
    projectId: string;
    billedCostBasisCents: number;
    currentCostBasisCents: number;
  } | null = null;
  if (isDraft && invoice.project_id) {
    const { data: projectRow } = await supabase
      .from('projects')
      .select('is_cost_plus')
      .eq('id', invoice.project_id)
      .maybeSingle();
    const isCostPlusProject = (projectRow?.is_cost_plus as boolean | null) !== false;
    if (isCostPlusProject) {
      const billed = lineItems
        .filter((li) => li.description === 'Labour' || li.description === 'Materials & Expenses')
        .reduce((s, li) => s + li.total_cents, 0);
      if (billed > 0) {
        const rollup = await getProjectCostBasisRollup(invoice.project_id);
        if (Math.abs(rollup.invoiceCostBasisCents - billed) > 100) {
          driftBanner = {
            projectId: invoice.project_id,
            billedCostBasisCents: billed,
            currentCostBasisCents: rollup.invoiceCostBasisCents,
          };
        }
      }
    }
  }

  // Customer-view preview — only for draft, tax-exclusive invoices with a
  // project. Tax-inclusive drafts encode customer total in amount_cents
  // (different line_items semantics); the preview helper assumes
  // tax-exclusive shape and would silently produce wrong totals.
  const showViewPreview = isDraft && !taxInclusive && Boolean(invoice.project_id);
  const viewPreviewInputs = showViewPreview
    ? await loadInvoiceCustomerViewInputs(invoice.id)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <DetailPageNav homeHref="/invoices" homeLabel="All invoices" />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Invoice</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">{docNumber}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight">
              {invoice.job ? `Job #${shortId(invoice.job.id)}` : 'Invoice'}
            </h1>
            <InvoiceStatusBadge status={invoice.status as InvoiceStatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            Created {formatTimestamp(invoice.created_at)}
          </p>
        </div>
        {(invoice.status === 'paid' || invoice.status === 'void') && (
          <DuplicateInvoiceButton invoiceId={invoice.id} />
        )}
      </header>

      {/* Status posture strip — sent = awaiting-payment (warn-soft);
       *  void = neutral closed; paid handled by PaidSection (success-soft)
       *  just below so it carries the receipt detail. */}
      {invoice.status === 'sent' && invoice.sent_at ? (
        <PostureStrip
          tone="warning"
          icon={<Hourglass className="size-4" aria-hidden />}
          primary="Awaiting payment"
          secondary={`Sent ${formatTimestamp(invoice.sent_at)}. Record the payment below once it lands.`}
        />
      ) : null}

      {invoice.status === 'void' ? (
        <PostureStrip
          tone="neutral"
          icon={<XCircle className="size-4" aria-hidden />}
          primary="This invoice has been voided"
          secondary="Closed — no further action. Duplicate it from the header to start a fresh draft."
        />
      ) : null}

      {invoice.status === 'paid' && invoice.paid_at ? (
        <PaidSection
          paidAt={formatTimestamp(invoice.paid_at)}
          method={invoice.payment_method}
          reference={invoice.payment_reference}
          notes={invoice.payment_notes}
          receiptPaths={invoice.payment_receipt_paths ?? []}
        />
      ) : null}

      {/* Customer-view preview — drafts only */}
      {viewPreviewInputs ? (
        <InvoiceViewModePreview
          invoiceId={invoice.id}
          initialMode={invoice.customer_view_mode ?? viewPreviewInputs.projectDefaultMode}
          initialMgmtFeeInline={invoice.customer_view_mgmt_fee_inline ?? false}
          projectDefaultMode={viewPreviewInputs.projectDefaultMode}
          inputs={{
            projectName: viewPreviewInputs.projectName,
            customerSummaryMd: viewPreviewInputs.customerSummaryMd,
            costLines: viewPreviewInputs.costLines,
            categories: viewPreviewInputs.categories,
            priorBilledCents: viewPreviewInputs.priorBilledCents,
            mgmtRate: viewPreviewInputs.mgmtRate,
            isCostPlus: viewPreviewInputs.isCostPlus,
            costPlusBreakdown: viewPreviewInputs.costPlusBreakdown,
          }}
          taxRate={taxCtx ? taxCtx.totalRate : 0.05}
          taxLabel={taxLabel}
        />
      ) : null}

      {/* Amount breakdown — suppressed on drafts while the preview surface
       *  is showing, since the preview IS the breakdown there. Sent / paid
       *  / void invoices always show the persisted breakdown. */}
      {!viewPreviewInputs ? (
        <section className="rounded-xl border bg-card p-5" aria-label="Amount breakdown">
          <div className="flex flex-col gap-2">
            {showSubtotalRow ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <Money cents={subtotalCents} />
              </div>
            ) : null}
            <InvoiceLineItems invoiceId={invoice.id} lineItems={lineItems} isDraft={isDraft} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{taxLabel}</span>
              <Money cents={invoice.tax_cents} />
            </div>
            <div className="mt-1 border-t pt-2">
              <div className="flex items-baseline justify-between text-base font-semibold">
                <span>Total</span>
                <Money cents={totalCents} emphasis className="text-lg" />
              </div>
            </div>
            {regParts.length > 0 ? (
              <p className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground">
                {regParts.join('  ·  ')}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Customer note */}
      <InvoiceNote invoiceId={invoice.id} note={invoice.customer_note} isDraft={isDraft} />

      {/* Customer + Job links */}
      <section className="grid gap-4 md:grid-cols-2">
        {invoice.customer && (
          <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <User className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Customer
              </span>
              <p className="text-sm font-medium">
                <Link
                  href={`/contacts/${invoice.customer.id}`}
                  className="hover:text-primary hover:underline"
                >
                  {invoice.customer.name}
                </Link>
              </p>
            </div>
          </div>
        )}
        {invoice.job && (
          <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <Briefcase className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Job
              </span>
              <p className="text-sm font-medium">
                <Link
                  href={`/jobs/${invoice.job.id}`}
                  className="hover:text-primary hover:underline"
                >
                  #{shortId(invoice.job.id)}
                </Link>
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Cautions (inline, not stacked banners): cost-basis drift +
       *  missing-GST. Restyled to warn/danger-soft inline strips so the
       *  preview/breakdown stays the hero. */}
      {driftBanner ? (
        <CostBasisDriftBanner
          projectId={driftBanner.projectId}
          billedCostBasisCents={driftBanner.billedCostBasisCents}
          currentCostBasisCents={driftBanner.currentCostBasisCents}
        />
      ) : null}

      {/* Defense-in-depth GST# warning — gate at send time should make
       *  this impossible, but if a draft predates the gate or the field
       *  was cleared, surface it inline so the operator can fix it
       *  without bouncing to settings. */}
      {showSetupBanner && !gstNumber ? <MissingGstNotice /> : null}

      {/* Document details — defaults-setup nudge + per-invoice overrides
       *  folded into ONE disclosure (config, not the main task). Opens on
       *  first paint only when something needs attention. */}
      {showSetupBanner ? (
        <InvoiceDocumentDetails needsAttention={docNeedsAttention} statusLabel={docStatusLabel}>
          <InvoiceDefaultsSetupBanner current={docFields} />
          <InvoiceOverridesEditor
            invoiceId={invoice.id}
            override={{
              payment_instructions: invoice.payment_instructions_override ?? null,
              terms: invoice.terms_override ?? null,
              policies: invoice.policies_override ?? null,
            }}
            tenant={docFields}
          />
        </InvoiceDocumentDetails>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <InvoiceActions
          invoiceId={invoice.id}
          status={invoice.status as InvoiceStatus}
          paymentUrl={invoice.pdf_url}
          customerEmail={invoice.customer?.email ?? null}
          customerAdditionalEmails={invoice.customer?.additional_emails ?? []}
          hasStripe={hasStripe}
          invoiceTotalCents={totalCents}
        />
        <PrintButton />
      </div>

      {/* Invoice-related worklog */}
      {worklog && worklog.length > 0 && (
        <section className="rounded-xl border bg-card p-5">
          <header className="pb-3">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              History
            </h2>
          </header>
          <ol className="relative ml-2 space-y-3 border-l border-muted pl-4">
            {worklog.map((entry) => (
              <li key={entry.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{entry.title ?? 'Entry'}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(entry.created_at)}
                  </span>
                </div>
                {entry.body ? (
                  <p className="mt-1 text-sm text-muted-foreground">{entry.body}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * Status posture strip — the calm, status-tokens soft-pair band that
 * replaces the old raw amber/emerald/destructive sections. Same soft-pair
 * + left-border chrome family as the inline cautions, but a fuller block
 * (icon chip + primary/secondary) for the page-level posture read.
 */
function PostureStrip({
  tone,
  icon,
  primary,
  secondary,
  children,
}: {
  tone: 'warning' | 'success' | 'neutral';
  icon: ReactNode;
  primary: string;
  secondary?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-l-2 border-l-brand p-4',
        statusToneClass[tone],
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="flex flex-1 flex-col gap-0.5 text-sm leading-snug">
          <span className="font-semibold">{primary}</span>
          {secondary ? <span className="text-[13px] opacity-90">{secondary}</span> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

async function PaidSection({
  paidAt,
  method,
  reference,
  notes,
  receiptPaths,
}: {
  paidAt: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  receiptPaths: string[];
}) {
  const urlMap = receiptPaths.length > 0 ? await getSignedUrls(receiptPaths) : new Map();

  return (
    <PostureStrip
      tone="success"
      icon={<CheckCircle2 className="size-4" aria-hidden />}
      primary={`Paid ${paidAt}${method ? ` · via ${method}` : ''}`}
      secondary={reference ? `Reference ${reference}` : undefined}
    >
      {notes ? <p className="whitespace-pre-line pl-7 text-[13px] opacity-90">{notes}</p> : null}
      {receiptPaths.length > 0 ? (
        <div className="flex flex-wrap gap-2 pl-7">
          {receiptPaths.map((path) => {
            const url = urlMap.get(path);
            if (!url) {
              return (
                <div
                  key={path}
                  className="flex size-16 items-center justify-center rounded-md border bg-background text-xs text-muted-foreground"
                >
                  Missing
                </div>
              );
            }
            return (
              <a
                key={path}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block size-16 overflow-hidden rounded-md border bg-background"
              >
                {/* biome-ignore lint/performance/noImgElement: signed URLs bypass next/image optimizer */}
                <img
                  src={url}
                  alt="Payment receipt"
                  className="size-full object-cover transition-transform hover:scale-105"
                />
              </a>
            );
          })}
        </div>
      ) : null}
    </PostureStrip>
  );
}

function DuplicateInvoiceButton({ invoiceId }: { invoiceId: string }) {
  async function action() {
    'use server';
    const result = await duplicateInvoiceAction({ invoiceId });
    if (!result.ok) throw new Error(result.error);
    const { redirect } = await import('next/navigation');
    redirect(`/invoices/${result.id}`);
  }

  return (
    <form action={action}>
      <Button type="submit" variant="outline" size="sm">
        <Copy className="size-3.5" />
        Duplicate
      </Button>
    </form>
  );
}
