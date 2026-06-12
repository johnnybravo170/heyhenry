'use client';

import { CheckCircle, Pencil, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { RecordPaymentDialog } from '@/components/features/invoices/record-payment-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import { invoiceTotalCents } from '@/lib/invoices/totals';
import { withFrom } from '@/lib/nav/from-link';
import { invoiceStatusTone, statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import {
  createInvoiceFromEstimateAction,
  createMilestoneInvoiceAction,
  deleteDrawAction,
  editDrawAction,
  generateFinalInvoiceAction,
} from '@/server/actions/invoices';

type InvoiceLineItem = {
  description?: string | null;
  quantity?: number | null;
  unit_price_cents?: number | null;
  total_cents?: number | null;
};

type InvoiceSummary = {
  id: string;
  status: string;
  doc_type: 'invoice' | 'draw' | 'final';
  tax_inclusive: boolean;
  percent_complete: number | null;
  amount_cents: number;
  tax_cents: number;
  line_items: InvoiceLineItem[] | null;
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

/** Initial values for editing an existing draw. When present, DrawForm edits
 *  that draw in place instead of creating a new one. */
type DrawEditInit = {
  invoiceId: string;
  label: string;
  percent: number | null;
  items: { description: string; amountRaw: string }[];
};

function DrawForm({
  projectId,
  defaultLabel,
  defaultPercent,
  taxRate,
  editDraw,
  onDone,
}: {
  projectId: string;
  defaultLabel: string;
  defaultPercent: number;
  /** Tenant's combined tax rate (e.g. 0.05). Drives the GST preview. */
  taxRate: number;
  /** When set, the form edits this existing draw instead of creating one. */
  editDraw?: DrawEditInit;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [label, setLabel] = useState(editDraw?.label ?? defaultLabel);
  const [percentRaw, setPercentRaw] = useState(
    editDraw ? (editDraw.percent !== null ? String(editDraw.percent) : '') : String(defaultPercent),
  );
  const [items, setItems] = useState(() =>
    editDraw && editDraw.items.length > 0
      ? editDraw.items.map((it) => ({ id: crypto.randomUUID(), ...it }))
      : [{ id: crypto.randomUUID(), description: '', amountRaw: '' }],
  );

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
    const lineItems = items.map((item) => ({
      description: item.description,
      quantity: 1,
      unitPriceCents: Math.round(parseFloat(item.amountRaw || '0') * 100),
    }));
    startTransition(async () => {
      if (editDraw) {
        const res = await editDrawAction({
          invoiceId: editDraw.invoiceId,
          label,
          percentComplete: pctNum,
          lineItems,
        });
        if (res.ok) {
          toast.success('Draw updated.');
          router.refresh();
          onDone();
        } else {
          setError(res.error);
        }
        return;
      }
      const res = await createMilestoneInvoiceAction({
        projectId,
        label,
        percentComplete: pctNum,
        lineItems,
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
  // GST is always added on top: entered line items are the pre-tax subtotal,
  // GST is computed on top to get the all-in customer total.
  const gstCents = Math.round(total * taxRate);
  const customerTotal = total + gstCents;

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
          <span className="text-muted-foreground">Subtotal: </span>
          <Money cents={total} className="font-medium" />
          <span className="text-muted-foreground ml-2">
            + <Money cents={gstCents} /> GST ={' '}
          </span>
          <Money cents={customerTotal} className="font-medium" />
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button variant="primary" type="submit" size="sm" disabled={pending}>
          {editDraw
            ? pending
              ? 'Saving…'
              : 'Save changes'
            : pending
              ? 'Creating…'
              : 'Create draw'}
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
  taxRate,
  approvedChangeOrderCents = 0,
}: {
  projectId: string;
  invoices: InvoiceSummary[];
  /** Sum of approved CO cost impact on this project. Approval updates the
   *  budget but does NOT auto-bill (locked) — so approved COs can silently
   *  go unbilled. Surfaced as the peach "now billable" nudge. We can't tell
   *  from the schema which approved COs are already on a draw (invoices carry
   *  no CO linkage), so the nudge is informational, not a hard delta. */
  approvedChangeOrderCents?: number;
  /** Sum of project_cost_lines + mgmt fee. Used to compute "% of contract"
   *  for each draw + the running total. Zero if the project hasn't been
   *  estimated yet. */
  contractRevenueCents: number;
  /** Estimate is signed/accepted by the customer. Gates the
   *  "Convert estimate to invoice" shortcut — the action itself doesn't
   *  enforce approval, but offering it on a draft would be misleading. */
  estimateApproved: boolean;
  /** Tenant combined tax rate for the new-draw preview. */
  taxRate: number;
}) {
  const router = useRouter();
  const [showDrawForm, setShowDrawForm] = useState(false);
  const [editDraw, setEditDraw] = useState<DrawEditInit | null>(null);
  const [finalPending, startFinalTransition] = useTransition();
  const [convertPending, startConvertTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  function startEditDraw(inv: InvoiceSummary) {
    setShowDrawForm(false);
    setEditDraw({
      invoiceId: inv.id,
      label: inv.customer_note ?? '',
      percent: inv.percent_complete,
      // Draws store one $-amount per line (quantity 1). Re-derive the
      // dollar string from total_cents (falls back to unit_price_cents).
      items: (inv.line_items ?? []).map((li) => ({
        description: li.description ?? '',
        amountRaw: ((li.total_cents ?? li.unit_price_cents ?? 0) / 100).toString(),
      })),
    });
  }

  function handleDeleteDraw(invoiceId: string) {
    startDeleteTransition(async () => {
      const res = await deleteDrawAction({ invoiceId });
      if (res.ok) {
        toast.success('Draw deleted.');
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
      {/* Now-billable nudge (peach). Approved COs update the budget but don't
       *  auto-bill; surface the approved total so it doesn't quietly leak.
       *  Informational — there's no CO→invoice linkage in the schema to net
       *  out what's already drawn, so the operator decides. */}
      {approvedChangeOrderCents > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border-l-2 border-brand bg-brand/5 p-3">
          <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
          <div className="flex-1 text-sm">
            <span className="mr-2 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-brand">
              Henry
            </span>
            <strong>
              <Money cents={approvedChangeOrderCents} /> in approved change orders.
            </strong>{' '}
            Approval updates the budget but doesn't bill — add it to the next draw?
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!showDrawForm && !editDraw && (
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
      </div>

      {showDrawForm && (
        <DrawForm
          projectId={projectId}
          defaultLabel={defaultLabel}
          defaultPercent={defaultPercent}
          taxRate={taxRate}
          onDone={() => setShowDrawForm(false)}
        />
      )}

      {editDraw && (
        <DrawForm
          key={editDraw.invoiceId}
          projectId={projectId}
          defaultLabel={defaultLabel}
          defaultPercent={defaultPercent}
          taxRate={taxRate}
          editDraw={editDraw}
          onDone={() => setEditDraw(null)}
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
                          {/* Mark paid is available from draft AND sent — a GC
                              who collected an out-of-band cheque records it
                              without sending first (Card #8). */}
                          {inv.status === 'draft' || inv.status === 'sent' ? (
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
                          {/* Edit + delete are allowed only while unpaid. Once
                              paid, removal is via void on the detail page. */}
                          {inv.status === 'draft' || inv.status === 'sent' ? (
                            <>
                              <Button size="xs" variant="ghost" onClick={() => startEditDraw(inv)}>
                                <Pencil className="size-3.5" />
                                Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    disabled={deletePending}
                                  >
                                    <Trash2 className="size-3.5" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this draw?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      "{inv.customer_note || `Draw ${inv.id.slice(0, 8)}`}" (
                                      <Money cents={total} />) will be removed. This can't be
                                      undone. A draw that's already been paid can't be deleted, only
                                      voided.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteDraw(inv.id)}>
                                      Delete draw
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
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
                          {/* Mark paid from draft AND sent (Card #8). */}
                          {inv.status === 'draft' || inv.status === 'sent' ? (
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
