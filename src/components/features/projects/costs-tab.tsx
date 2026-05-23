'use client';

/**
 * Project Costs tab. Post-unification this is a thin orchestrator:
 *
 *   - "Money out" panel (Committed / Vendor-billed / Paid) + uncategorized alert
 *   - "By type" vs "By category" toggle, under a Procurement scope head
 *   - Subtab nav (Vendor quotes / POs / Costs)
 *   - One of: SubQuotesSection, PO section, ProjectCostsSection
 *
 * The Bills + Expenses subtabs collapsed into a single "Costs" surface
 * driven by `ProjectCostsSection` — receipts and vendor bills share
 * one table with status badges + a payment filter.
 */

import { TriangleAlert } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import type { PurchaseOrderRow, PurchaseOrderStatus } from '@/lib/db/queries/purchase-orders';
import { formatCurrency } from '@/lib/pricing/calculator';
import {
  createPurchaseOrderAction,
  updatePurchaseOrderStatusAction,
} from '@/server/actions/project-cost-control';
import { CostsByCategoryView } from './costs-by-category-view';
import { type CostsSubtabCount, type CostsSubtabKey, CostsSubtabs } from './costs-subtabs';
import { type BillItem, type ExpenseItem, ProjectCostsSection } from './project-costs-section';
import { type SubQuoteItem, SubQuotesSection } from './sub-quotes-section';

function displayToCents(val: string) {
  return Math.round(parseFloat(val || '0') * 100);
}

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  acknowledged: 'Acknowledged',
  received: 'Received',
  closed: 'Closed',
};

const STATUS_NEXT: Record<PurchaseOrderStatus, PurchaseOrderStatus | null> = {
  draft: 'sent',
  sent: 'acknowledged',
  acknowledged: 'received',
  received: 'closed',
  closed: null,
};

// ─── PO form ──────────────────────────────────────────────────────────────────

function POForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [vendor, setVendor] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ label: '', qty: '1', unit: 'item', costRaw: '' }]);

  function addItem() {
    setItems((prev) => [...prev, { label: '', qty: '1', unit: 'item', costRaw: '' }]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: string, value: string) {
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const res = await createPurchaseOrderAction({
        project_id: projectId,
        vendor,
        po_number: poNumber,
        issued_date: issuedDate,
        expected_date: expectedDate,
        notes,
        items: items.map((item) => ({
          label: item.label,
          qty: parseFloat(item.qty || '1'),
          unit: item.unit,
          unit_cost_cents: displayToCents(item.costRaw),
        })),
      });
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  const total = items.reduce(
    (s, item) => s + Math.round(parseFloat(item.qty || '1') * displayToCents(item.costRaw)),
    0,
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="po-vendor" className="mb-1 block text-xs font-medium">
            Vendor
          </label>
          <Input
            id="po-vendor"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Supplier name"
            required
          />
        </div>
        <div>
          <label htmlFor="po-number" className="mb-1 block text-xs font-medium">
            PO #
          </label>
          <Input
            id="po-number"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <label htmlFor="po-issued" className="mb-1 block text-xs font-medium">
            Issue Date
          </label>
          <Input
            id="po-issued"
            type="date"
            value={issuedDate}
            onChange={(e) => setIssuedDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="po-expected" className="mb-1 block text-xs font-medium">
            Expected Date
          </label>
          <Input
            id="po-expected"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="po-notes" className="mb-1 block text-xs font-medium">
            Notes
          </label>
          <Input
            id="po-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium">Line Items</p>
        <div className="space-y-2">
          {items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable ephemeral list, no external IDs
            <div key={i} className="grid grid-cols-12 gap-2">
              <div className="col-span-4">
                <Input
                  value={item.label}
                  onChange={(e) => updateItem(i, 'label', e.target.value)}
                  placeholder="Description"
                  required
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={item.qty}
                  onChange={(e) => updateItem(i, 'qty', e.target.value)}
                  placeholder="Qty"
                />
              </div>
              <div className="col-span-2">
                <Input
                  value={item.unit}
                  onChange={(e) => updateItem(i, 'unit', e.target.value)}
                  placeholder="unit"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.costRaw}
                  onChange={(e) => updateItem(i, 'costRaw', e.target.value)}
                  placeholder="Cost / unit"
                />
              </div>
              <div className="col-span-1 flex items-center">
                {items.length > 1 && (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeItem(i)}
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={addItem}>
          + Add item
        </Button>
      </div>

      {total > 0 && <p className="text-sm font-medium">Total: {formatCurrency(total)}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Creating…' : 'Create PO'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CostsTab({
  projectId,
  purchaseOrders,
  bills,
  subQuotes,
  expenses,
  categories,
}: {
  projectId: string;
  purchaseOrders: PurchaseOrderRow[];
  bills: BillItem[];
  subQuotes: SubQuoteItem[];
  expenses: ExpenseItem[];
  categories: Array<{
    id: string;
    name: string;
    section: 'interior' | 'exterior' | 'general';
    cost_lines: Array<{ id: string; label: string }>;
  }>;
}) {
  const [showPOForm, setShowPOForm] = useState(false);
  const [, startTransition] = useTransition();

  function advancePOStatus(po: PurchaseOrderRow) {
    const next = STATUS_NEXT[po.status];
    if (!next) return;
    startTransition(async () => {
      await updatePurchaseOrderStatusAction(po.id, next, projectId);
    });
  }

  // Open POs = active obligations (sent/acknowledged/received), part of
  // Committed below.
  const committedPos = purchaseOrders
    .filter((po) => ['sent', 'acknowledged', 'received'].includes(po.status))
    .reduce((s, po) => s + po.total_cents, 0);
  const committedQuotes = subQuotes
    .filter((q) => q.status === 'accepted')
    .reduce((s, q) => s + q.total_cents, 0);
  // ONE reconciled Committed = accepted sub-quotes + open POs. Matches
  // `getVarianceReport.committed_cents` (committed_vendor_quotes_cents +
  // committed_pos_cents); sub-quotes + POs are its breakdown, not two
  // parallel headline silos.
  const committedTotal = committedQuotes + committedPos;

  // Billed = all vendor bills received (pre-GST subtotal, matching the
  // variance model). Paid = bills actually settled + receipts (which are
  // paid by definition). The old "Paid" cell summed *all expenses* and
  // ignored paid bills entirely — that was the bug.
  const totalBills = bills.reduce((s, b) => s + b.amount_cents, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const paidBills = bills
    .filter((b) => b.status === 'paid')
    .reduce((s, b) => s + b.amount_cents, 0);
  const paidTotal = paidBills + totalExpenses;
  // Unpaid vendor bills — the rust "chase" shout in the Money-out panel.
  const unpaidBilledCents = bills
    .filter((b) => b.status !== 'paid')
    .reduce((s, b) => s + b.amount_cents, 0);
  // Spend-owned alert: costs with no budget category, awaiting filing.
  const uncategorizedCount =
    bills.filter((b) => !b.budget_category_id).length +
    expenses.filter((e) => !e.budget_category_id).length;

  const searchParams = useSearchParams();
  const sub: CostsSubtabKey = (() => {
    const raw = searchParams?.get('sub');
    if (raw === 'quotes' || raw === 'pos' || raw === 'costs') return raw;
    // Legacy deep-links (?sub=bills, ?sub=expenses) — fold into Costs.
    if (raw === 'bills' || raw === 'expenses') return 'costs';
    // Stable landing subtab — always Costs (the actual money-out ledger of
    // bills + receipts). Previously this shifted based on which subtab had
    // data, so the same project could land you on a different tab as spend
    // accrued — disorienting. Quotes / POs are one labeled click away.
    return 'costs';
  })();
  const groupByCategory = searchParams?.get('view') === 'category';
  // Drill-down filter: Budget tab links here with `?focus=<budget_category_id>`
  // (category-level) or `?focus_line=<cost_line_id>` (line-level) so the operator
  // lands on Spend already filtered. Bills, expenses, and vendor-quote
  // allocations carry budget_category_id directly. POs match through their
  // line items' cost_line.budget_category_id (resolved in
  // listPurchaseOrders). focus_line is finer-grained — applied on top of /
  // instead of focus.
  const focusCategoryId = searchParams?.get('focus');
  const focusLineId = searchParams?.get('focus_line');
  const filteredBills = focusLineId
    ? bills.filter((b) => b.cost_line_id === focusLineId)
    : focusCategoryId
      ? bills.filter((b) => b.budget_category_id === focusCategoryId)
      : bills;
  const filteredExpenses = focusLineId
    ? expenses.filter((e) => e.cost_line_id === focusLineId)
    : focusCategoryId
      ? expenses.filter((e) => e.budget_category_id === focusCategoryId)
      : expenses;
  const filteredSubQuotes = focusLineId
    ? // Sub-quote allocations are per-category only — hide all when filtering
      // to a single line. Honest empty state beats "every quote against this
      // category also lights up under every line", which would be misleading.
      []
    : focusCategoryId
      ? subQuotes.filter((q) => q.allocations.some((a) => a.budget_category_id === focusCategoryId))
      : subQuotes;
  const filteredPurchaseOrders = focusLineId
    ? purchaseOrders.filter((po) => po.items.some((it) => it.cost_line_id === focusLineId))
    : focusCategoryId
      ? purchaseOrders.filter((po) =>
          po.items.some((it) => it.budget_category_id === focusCategoryId),
        )
      : purchaseOrders;
  const focusCategoryName = focusCategoryId
    ? categories.find((b) => b.id === focusCategoryId)?.name
    : null;
  const focusLineLabel = focusLineId
    ? categories.flatMap((b) => b.cost_lines).find((l) => l.id === focusLineId)?.label
    : null;
  const pendingQuotes = filteredSubQuotes.filter((q) => q.status === 'pending_review').length;
  const activePOs = filteredPurchaseOrders.filter((po) =>
    ['sent', 'acknowledged', 'received'].includes(po.status),
  ).length;
  const subtabCounts: Record<CostsSubtabKey, CostsSubtabCount> = {
    quotes: {
      count: filteredSubQuotes.length,
      hint: pendingQuotes > 0 ? `${pendingQuotes} pending` : undefined,
      warn: pendingQuotes > 0,
    },
    pos: {
      count: filteredPurchaseOrders.length,
      hint: activePOs > 0 ? `${activePOs} active` : undefined,
    },
    costs: { count: filteredBills.length + filteredExpenses.length },
  };

  return (
    <div className="space-y-4">
      {/* Spend-owned alert: uncategorized costs awaiting filing. Tapping
          jumps to the By-category lens where the uncategorized bucket lives. */}
      {uncategorizedCount > 0 ? (
        <a
          href={`/projects/${projectId}?tab=costs&view=category`}
          className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-100 px-3 py-1.5 text-sm text-foreground hover:bg-amber-200/70 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <TriangleAlert className="size-3.5 text-amber-700 dark:text-amber-300" aria-hidden />
          <strong className="font-semibold">
            {uncategorizedCount} uncategorized cost{uncategorizedCount === 1 ? '' : 's'}
          </strong>
        </a>
      ) : null}

      {/* "Money out" panel — Committed (Quotes · POs breakdown) · Vendor-billed
          (rust unpaid shout) · Paid. Committed reconciles with the Budget tab;
          internal hours live on Labour. */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-baseline justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Money out</span>
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            External · vendors &amp; subs only
          </span>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Committed
            </span>
            <Money cents={committedTotal} className="text-lg font-semibold" />
            {committedQuotes > 0 || committedPos > 0 ? (
              <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                Quotes <Money cents={committedQuotes} className="text-foreground" /> · POs{' '}
                <Money cents={committedPos} className="text-foreground" />
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Vendor-billed
            </span>
            <Money cents={totalBills} className="text-lg font-semibold" />
            {unpaidBilledCents > 0 ? (
              <a
                href={`/projects/${projectId}?tab=costs&sub=costs&costs=unpaid`}
                className="text-xs font-medium text-brand hover:underline"
              >
                <Money cents={unpaidBilledCents} className="text-brand" /> unpaid →
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">All settled</span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Paid
            </span>
            <Money cents={paidTotal} className="text-lg font-semibold" />
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Actually paid out
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            <strong className="font-medium text-foreground">Committed</strong> reconciles with the
            Budget tab
          </span>
          <a
            href={`/projects/${projectId}?tab=time`}
            className="font-mono text-[11px] uppercase tracking-wide hover:text-foreground"
          >
            Sub time + worker invoices live on Labour →
          </a>
        </div>
      </div>

      {/* Scope head — procurement framing + By type / By category lens. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Procurement{' '}
          <span className="font-normal text-muted-foreground/60">
            · external money-out workflow
          </span>
        </div>
        <div className="flex rounded-md border bg-muted/30 p-0.5 text-xs">
          <a
            href={`/projects/${projectId}?tab=costs${focusCategoryId ? `&focus=${focusCategoryId}` : ''}${focusLineId ? `&focus_line=${focusLineId}` : ''}`}
            className={`rounded px-2 py-1 ${!groupByCategory ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            By type
          </a>
          <a
            href={`/projects/${projectId}?tab=costs&view=category${focusCategoryId ? `&focus=${focusCategoryId}` : ''}${focusLineId ? `&focus_line=${focusLineId}` : ''}`}
            className={`rounded px-2 py-1 ${groupByCategory ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            By category
          </a>
        </div>
      </div>

      {!groupByCategory ? <CostsSubtabs counts={subtabCounts} /> : null}

      {focusLineId && focusLineLabel ? (
        <div className="flex items-center justify-between rounded-md border border-amber-300/60 bg-amber-50/50 px-3 py-2 text-xs">
          <span>
            Filtered to line item <span className="font-semibold">{focusLineLabel}</span>
          </span>
          <a
            href={`/projects/${projectId}?tab=costs&sub=${sub}`}
            className="text-primary hover:underline"
          >
            Clear filter
          </a>
        </div>
      ) : focusCategoryId && focusCategoryName ? (
        <div className="flex items-center justify-between rounded-md border border-amber-300/60 bg-amber-50/50 px-3 py-2 text-xs">
          <span>
            Filtered to <span className="font-semibold">{focusCategoryName}</span>
          </span>
          <a
            href={`/projects/${projectId}?tab=costs&sub=${sub}`}
            className="text-primary hover:underline"
          >
            Clear filter
          </a>
        </div>
      ) : null}

      {groupByCategory ? (
        <CostsByCategoryView
          categories={categories}
          bills={filteredBills}
          expenses={filteredExpenses}
          subQuotes={filteredSubQuotes}
          purchaseOrders={filteredPurchaseOrders}
        />
      ) : null}

      {!groupByCategory && sub === 'quotes' ? (
        <SubQuotesSection
          projectId={projectId}
          subQuotes={filteredSubQuotes}
          categories={categories}
        />
      ) : null}

      {!groupByCategory && sub === 'costs' ? (
        <ProjectCostsSection
          projectId={projectId}
          bills={filteredBills}
          expenses={filteredExpenses}
          categories={categories.map((b) => ({
            id: b.id,
            name: b.name,
            cost_lines: b.cost_lines,
          }))}
        />
      ) : null}

      {!groupByCategory && sub === 'pos' ? (
        /* Purchase Orders */
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Purchase Orders</h3>
            {!showPOForm && (
              <Button size="sm" onClick={() => setShowPOForm(true)}>
                + New PO
              </Button>
            )}
          </div>

          {showPOForm && (
            <div className="mb-4">
              <POForm projectId={projectId} onDone={() => setShowPOForm(false)} />
            </div>
          )}

          {filteredPurchaseOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {focusCategoryName
                ? `No purchase orders in ${focusCategoryName}.`
                : 'No purchase orders yet.'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredPurchaseOrders.map((po) => {
                const next = STATUS_NEXT[po.status];
                return (
                  <div key={po.id} className="rounded-md border">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div>
                        <p className="font-medium">{po.vendor}</p>
                        <p className="text-xs text-muted-foreground">
                          {po.po_number ? `PO #${po.po_number} · ` : ''}
                          {STATUS_LABELS[po.status]}
                          {po.expected_date ? ` · Expected ${po.expected_date}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Money cents={po.total_cents} className="font-semibold" />
                        {next && (
                          <Button size="xs" variant="outline" onClick={() => advancePOStatus(po)}>
                            Mark {STATUS_LABELS[next]}
                          </Button>
                        )}
                      </div>
                    </div>
                    {po.items.length > 0 && (
                      <div className="border-t px-4 py-2">
                        <table className="w-full text-xs">
                          <tbody>
                            {po.items.map((item) => (
                              <tr key={item.id} className="border-b last:border-0">
                                <td className="py-1 pr-4">{item.label}</td>
                                <td className="py-1 pr-4 text-muted-foreground">
                                  {Number(item.qty)} {item.unit}
                                </td>
                                <td className="py-1 text-right">
                                  <Money cents={item.line_total_cents} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {committedPos > 0 && (
                <p className="text-right text-sm">
                  <span className="text-muted-foreground">Committed (open POs): </span>
                  <Money cents={committedPos} className="font-semibold" />
                </p>
              )}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
