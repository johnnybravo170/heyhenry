'use client';

import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { RecordPaymentDialog } from '@/components/features/invoices/record-payment-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import type { DrawGstMode } from '@/lib/invoices/draw-gst-mode';
import { invoiceTotalCents } from '@/lib/invoices/totals';
import { withFrom } from '@/lib/nav/from-link';
import { invoiceStatusTone, statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import {
  createInvoiceFromEstimateAction,
  createMilestoneInvoiceAction,
  generateFinalInvoiceAction,
  setProjectDrawGstModeAction,
} from '@/server/actions/invoices';

type InvoiceSummary = {
  id: string;
  status: string;
  doc_type: 'invoice' | 'draw' | 'final';
  tax_inclusive: boolean;
  percent_complete: number | null;
  amount_cents: number;
  tax_cents: number;
  line_items: { total_cents?: number | null }[] | null;
  customer_note: string | null;
  created_at: string;
};

/** Draw / invoice status pill. Maps the lifecycle status to its canonical
 *  tone (draft→neutral, sent→info, paid→success, void→neutral). The OD's
 *  overdue=danger state needs a sent-date the live row props don't carry yet
 *  — deferred until that derived signal exists. */
function StatusPill({ status }: { status: string }) {
  const tone = invoiceStatusTone[status as keyof typeof invoiceStatusTone] ?? 'neutral';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        statusToneClass[tone],
      )}
    >
      {status}
    </span>
  );
}

function DrawForm({
  projectId,
  defaultLabel,
  defaultPercent,
  gstMode,
  taxRate,
  onDone,
}: {
  projectId: string;
  defaultLabel: string;
  defaultPercent: number;
  /** Resolved project GST mode — drives the preview math + label. */
  gstMode: DrawGstMode;
  /** Tenant's combined tax rate (e.g. 0.05). Drives the GST preview. */
  taxRate: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [label, setLabel] = useState(defaultLabel);
  const [percentRaw, setPercentRaw] = useState(String(defaultPercent));
  const [items, setItems] = useState([{ id: crypto.randomUUID(), description: '', amountRaw: '' }]);

  function addItem() {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), description: '', amountRaw: '' }]);
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }
  function updateItem(id: string, field: 'description' | 'amountRaw', value: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const pctNum = percentRaw.trim() === '' ? null : Number(percentRaw);
    if (pctNum !== null && (Number.isNaN(pctNum) || pctNum < 0 || pctNum > 100)) {
      setError('% complete must be between 0 and 100.');
      return;
    }
    startTransition(async () => {
      const res = await createMilestoneInvoiceAction({
        projectId,
        label,
        percentComplete: pctNum,
        lineItems: items.map((item) => ({
          description: item.description,
          quantity: 1,
          unitPriceCents: Math.round(parseFloat(item.amountRaw || '0') * 100),
        })),
      });
      if (res.ok) {
        toast.success('Draw created.');
        router.push(
          withFrom(
            `/invoices/${res.id}`,
            `/projects/${projectId}?tab=invoices`,
            'Customer Billing',
          ),
        );
      } else {
        setError(res.error);
      }
    });
  }

  const total = items.reduce(
    (s, item) => s + Math.round(parseFloat(item.amountRaw || '0') * 100),
    0,
  );
  // GST preview depends on the project's mode:
  //  - inclusive: entered total is the all-in; back-compute embedded GST.
  //  - on_top: entered total is the subtotal; add GST to get the all-in.
  const onTop = gstMode === 'on_top';
  const gstCents = onTop
    ? Math.round(total * taxRate)
    : Math.round((total * taxRate) / (1 + taxRate));
  const customerTotal = onTop ? total + gstCents : total;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="draw-label" className="mb-1 block text-xs font-medium">
            Milestone Label
          </label>
          <Input
            id="draw-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Deposit, Draw #1, Rough-in complete"
            required
          />
        </div>
        <div>
          <label htmlFor="draw-percent" className="mb-1 block text-xs font-medium">
            % Complete <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="draw-percent"
            type="number"
            min="0"
            max="100"
            step="1"
            value={percentRaw}
            onChange={(e) => setPercentRaw(e.target.value)}
            placeholder="e.g. 40"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium">Line Items</p>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-2">
              <div className="col-span-7">
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  placeholder="Description"
                  required
                />
              </div>
              <div className="col-span-4">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.amountRaw}
                  onChange={(e) => updateItem(item.id, 'amountRaw', e.target.value)}
                  placeholder="Amount ($)"
                  required
                />
              </div>
              <div className="col-span-1 flex items-center">
                {items.length > 1 && (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeItem(item.id)}
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={addItem}>
          + Add line
        </Button>
      </div>

      {total > 0 && (
        <p className="text-sm">
          {onTop ? (
            <>
              <span className="text-muted-foreground">Subtotal: </span>
              <Money cents={total} className="font-medium" />
              <span className="text-muted-foreground ml-2">
                + <Money cents={gstCents} /> GST ={' '}
              </span>
              <Money cents={customerTotal} className="font-medium" />
            </>
          ) : (
            <>
              <span className="text-muted-foreground">Total: </span>
              <Money cents={customerTotal} className="font-medium" />
              <span className="text-muted-foreground ml-2">
                (incl. <Money cents={gstCents} /> GST)
              </span>
            </>
          )}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Creating…' : 'Create draw'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function InvoicesTab({
  projectId,
  invoices,
  contractRevenueCents,
  estimateApproved,
  drawGstMode,
  projectGstModeOverride,
  tenantDefaultGstMode,
  taxRate,
}: {
  projectId: string;
  invoices: InvoiceSummary[];
  /** Sum of project_cost_lines + mgmt fee. Used to compute "% of contract"
   *  for each draw + the running total. Zero if the project hasn't been
   *  estimated yet. */
  contractRevenueCents: number;
  /** Estimate is signed/accepted by the customer. Gates the
   *  "Convert estimate to invoice" shortcut — the action itself doesn't
   *  enforce approval, but offering it on a draft would be misleading. */
  estimateApproved: boolean;
  /** Resolved draw GST mode (project override → tenant default → inclusive). */
  drawGstMode: DrawGstMode;
  /** The project's own override, or null when inheriting the tenant default. */
  projectGstModeOverride: string | null;
  /** Tenant default, shown in the "Account default" option label. */
  tenantDefaultGstMode: DrawGstMode;
  /** Tenant combined tax rate for the new-draw preview. */
  taxRate: number;
}) {
  const router = useRouter();
  const [showDrawForm, setShowDrawForm] = useState(false);
  const [finalPending, startFinalTransition] = useTransition();
  const [convertPending, startConvertTransition] = useTransition();
  const [gstModePending, startGstModeTransition] = useTransition();

  function handleGstModeChange(value: string) {
    const next = value === 'inherit' ? null : (value as DrawGstMode);
    startGstModeTransition(async () => {
      const res = await setProjectDrawGstModeAction({ projectId, mode: next });
      if (res.ok) {
        toast.success('Draw GST display updated.');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleFinalInvoice() {
    startFinalTransition(async () => {
      const res = await generateFinalInvoiceAction({ projectId });
      if (res.ok) {
        toast.success('Final invoice created.');
        router.push(
          withFrom(
            `/invoices/${res.id}`,
            `/projects/${projectId}?tab=invoices`,
            'Customer Billing',
          ),
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleConvertEstimate() {
    if (
      !confirm('Create a draft invoice for the full estimate amount? You can edit before sending.')
    )
      return;
    startConvertTransition(async () => {
      const res = await createInvoiceFromEstimateAction({ projectId });
      if (res.ok && res.id) {
        toast.success('Invoice created from estimate.');
        router.push(
          withFrom(
            `/invoices/${res.id}`,
            `/projects/${projectId}?tab=invoices`,
            'Customer Billing',
          ),
        );
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  // Split: doc_type='draw' is a milestone draw; everything else is a
  // regular invoice (incl. doc_type='final', or legacy untyped rows).
  const draws = invoices.filter((inv) => inv.doc_type === 'draw');
  const otherInvoices = invoices.filter((inv) => inv.doc_type !== 'draw');

  // Single source of truth for the customer total — handles inclusive draws
  // (amount IS the all-in), on-top draws + estimate-derived invoices
  // (amount + additive line_items + GST), and legacy rows.
  function customerTotalCents(inv: InvoiceSummary) {
    return invoiceTotalCents(inv);
  }

  const drawsTotalCents = draws
    .filter((inv) => inv.status !== 'void')
    .reduce((s, inv) => s + customerTotalCents(inv), 0);
  const drawsPctOfContract =
    contractRevenueCents > 0 ? (drawsTotalCents / contractRevenueCents) * 100 : null;

  const drawCount = draws.filter((inv) => inv.status !== 'void').length;
  const defaultLabel = `Draw #${drawCount + 1}`;
  // Auto-bump the suggested % complete based on running total of the
  // contract billed so far. Operator can override.
  const defaultPercent =
    contractRevenueCents > 0
      ? Math.min(100, Math.round((drawsTotalCents / contractRevenueCents) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {!showDrawForm && (
          <Button
            size="sm"
            onClick={() => setShowDrawForm(true)}
            className="bg-brand text-white hover:bg-brand/90"
          >
            + New draw
          </Button>
        )}
        {estimateApproved && contractRevenueCents > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleConvertEstimate}
            disabled={convertPending}
            title="Create one invoice for the full estimate (lump-sum, no draws)"
          >
            {convertPending ? 'Creating…' : 'Invoice full estimate'}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={handleFinalInvoice} disabled={finalPending}>
          {finalPending ? 'Generating…' : 'Generate final invoice'}
        </Button>

        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          GST on draws
          <select
            className="rounded-md border bg-background px-2 py-1 text-foreground"
            value={projectGstModeOverride ?? 'inherit'}
            onChange={(e) => handleGstModeChange(e.target.value)}
            disabled={gstModePending}
          >
            <option value="inherit">
              Account default ({tenantDefaultGstMode === 'on_top' ? 'on top' : 'included'})
            </option>
            <option value="inclusive">GST included</option>
            <option value="on_top">GST on top</option>
          </select>
        </label>
      </div>

      {showDrawForm && (
        <DrawForm
          projectId={projectId}
          defaultLabel={defaultLabel}
          defaultPercent={defaultPercent}
          gstMode={drawGstMode}
          taxRate={taxRate}
          onDone={() => setShowDrawForm(false)}
        />
      )}

      {/* Draws section */}
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold">
            Draws{' '}
            {drawCount > 0 ? (
              <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                {drawCount}
              </span>
            ) : null}
          </h3>
          {drawsTotalCents > 0 ? (
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground tabular-nums">
              Drawn to date{' '}
              <Money cents={drawsTotalCents} className="font-semibold text-foreground" />
              {contractRevenueCents > 0 ? (
                <>
                  {' '}
                  of <Money cents={contractRevenueCents} />
                  {drawsPctOfContract !== null ? ` · ${Math.round(drawsPctOfContract)}%` : null}
                </>
              ) : null}
            </span>
          ) : null}
        </div>
        {draws.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No draws yet. Use "+ New draw" above to bill a milestone.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">Label</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">% Complete</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-right font-semibold">% of Contract</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {draws.map((inv) => {
                  const total = customerTotalCents(inv);
                  const pctOfContract =
                    contractRevenueCents > 0
                      ? Math.round((total / contractRevenueCents) * 100)
                      : null;
                  return (
                    <tr
                      key={inv.id}
                      className={`border-b last:border-0 ${inv.status === 'void' ? 'opacity-50' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium">
                        <Link
                          href={withFrom(
                            `/invoices/${inv.id}`,
                            `/projects/${projectId}?tab=invoices`,
                            'Customer Billing',
                          )}
                          className="hover:text-primary hover:underline"
                        >
                          {inv.customer_note || `Draw ${inv.id.slice(0, 8)}`}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={inv.status} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {inv.percent_complete !== null ? `${inv.percent_complete}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        <Money cents={total} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {pctOfContract !== null ? `${pctOfContract}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === 'sent' ? (
                            <RecordPaymentDialog
                              invoiceId={inv.id}
                              invoiceTotalCents={total}
                              trigger={
                                <Button size="xs" variant="outline">
                                  <CheckCircle className="size-3.5" />
                                  Mark paid
                                </Button>
                              }
                            />
                          ) : null}
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              router.push(
                                withFrom(
                                  `/invoices/${inv.id}`,
                                  `/projects/${projectId}?tab=invoices`,
                                  'Customer Billing',
                                ),
                              )
                            }
                          >
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Final / other invoices section — only render when there's
          something to show, since most projects ship draws + one final. */}
      {otherInvoices.length > 0 ? (
        <section>
          <h3 className="mb-2 text-base font-semibold">Invoices</h3>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">Label</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 text-right font-semibold">Tax</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {otherInvoices.map((inv) => {
                  const total = customerTotalCents(inv);
                  return (
                    <tr
                      key={inv.id}
                      className={`border-b last:border-0 ${inv.status === 'void' ? 'opacity-50' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium">
                        <Link
                          href={withFrom(
                            `/invoices/${inv.id}`,
                            `/projects/${projectId}?tab=invoices`,
                            'Customer Billing',
                          )}
                          className="hover:text-primary hover:underline"
                        >
                          {inv.customer_note ||
                            (inv.doc_type === 'final'
                              ? 'Final invoice'
                              : `Invoice ${inv.id.slice(0, 8)}`)}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={inv.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money cents={inv.amount_cents} />
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        <Money cents={inv.tax_cents} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        <Money cents={total} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === 'sent' ? (
                            <RecordPaymentDialog
                              invoiceId={inv.id}
                              invoiceTotalCents={total}
                              trigger={
                                <Button size="xs" variant="outline">
                                  <CheckCircle className="size-3.5" />
                                  Mark paid
                                </Button>
                              }
                            />
                          ) : null}
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              router.push(
                                withFrom(
                                  `/invoices/${inv.id}`,
                                  `/projects/${projectId}?tab=invoices`,
                                  'Customer Billing',
                                ),
                              )
                            }
                          >
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
