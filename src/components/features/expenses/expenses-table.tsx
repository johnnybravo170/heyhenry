'use client';

/**
 * Expenses table with batch selection.
 *
 * Same layout as the static version — date, category, vendor, optional
 * project column, tax, amount, receipt, per-row delete. Adds a checkbox
 * column and a floating action bar that appears when N > 0 rows are
 * selected: Recategorize (opens a category picker dialog) or Delete.
 *
 * Used on both /expenses and /bk/expenses. Props decide whether the
 * project column shows up and whether the delete button is rendered
 * per-row (bookkeeper view hides per-row delete on project-linked rows).
 */

import { Tag, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { DeleteExpenseButton } from '@/components/features/expenses/delete-expense-button';
import { ReceiptPreviewButton } from '@/components/features/expenses/receipt-preview-button';
import { PaymentSourcePill } from '@/components/features/payment-sources/payment-source-pill';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/ui/money';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import { formatDateShort } from '@/lib/date/format';
import type { CategoryPickerOption } from '@/lib/db/queries/expense-categories';
import type { OverheadExpenseRow } from '@/lib/db/queries/overhead-expenses';
import type { PaymentSourceLite } from '@/lib/db/queries/payment-sources';
import {
  bulkDeleteExpensesAction,
  bulkRecategorizeExpensesAction,
  bulkSetPaymentSourceAction,
} from '@/server/actions/overhead-expenses';

type Props = {
  expenses: OverheadExpenseRow[];
  categories: CategoryPickerOption[];
  paymentSources: PaymentSourceLite[];
  /** true on /bk/expenses (shows project column + links). */
  showProjectColumn?: boolean;
  /** true = link row to operator edit page. false = don't render links. */
  editHrefForOverhead?: (id: string) => string;
  /** Optional count summary shown in the table strip ("12 of 37"). */
  shownOf?: { shown: number; total: number };
  /** Optional CSV export href for the table strip. */
  exportHref?: string;
  /** Optional footer (pager) rendered inside the table card. */
  footer?: ReactNode;
};

export function ExpensesTable({
  expenses,
  categories,
  paymentSources,
  showProjectColumn,
  editHrefForOverhead,
  shownOf,
  exportHref,
  footer,
}: Props) {
  const router = useRouter();
  const tz = useTenantTimezone();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recatOpen, setRecatOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [targetSource, setTargetSource] = useState('');
  const [pending, startTransition] = useTransition();

  const selectable = useMemo(
    // Project-linked rows aren't recategorizable by bulk action (they
    // have their own edit path). Filter them out of the selectable pool.
    () => expenses.filter((e) => !e.project_id),
    [expenses],
  );

  const allSelected = selectable.length > 0 && selectable.every((e) => selected.has(e.id));

  function toggleAll(v: boolean) {
    if (v) setSelected(new Set(selectable.map((e) => e.id)));
    else setSelected(new Set());
  }

  function toggleOne(id: string, v: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function runRecategorize() {
    if (!targetCategory) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkRecategorizeExpensesAction({
        ids,
        category_id: targetCategory,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.updated} expense${res.updated === 1 ? '' : 's'} recategorized`);
      setSelected(new Set());
      setRecatOpen(false);
      setTargetCategory('');
      router.refresh();
    });
  }

  function runSetSource() {
    if (!targetSource) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkSetPaymentSourceAction({
        ids,
        payment_source_id: targetSource,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.updated} expense${res.updated === 1 ? '' : 's'} updated`);
      setSelected(new Set());
      setSourceOpen(false);
      setTargetSource('');
      router.refresh();
    });
  }

  function runDelete() {
    const ids = Array.from(selected);
    if (
      !confirm(
        `Delete ${ids.length} expense${ids.length === 1 ? '' : 's'}? This also removes receipts.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await bulkDeleteExpensesAction({ ids });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.deleted} expense${res.deleted === 1 ? '' : 's'} deleted`);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        {shownOf || exportHref ? (
          <div className="flex items-center gap-3 border-b px-4 py-2.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ledger
            </span>
            {shownOf ? (
              <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground tabular-nums">
                · showing {shownOf.shown} of {shownOf.total}
              </span>
            ) : null}
            {exportHref ? (
              <a
                href={exportHref}
                className="ml-auto font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              >
                Export CSV
              </a>
            ) : null}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="w-10 px-3 py-2.5 pl-4">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    disabled={selectable.length === 0}
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Date
                </th>
                <th className="px-3 py-2.5 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Category
                </th>
                <th className="px-3 py-2.5 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Vendor
                </th>
                <th className="px-3 py-2.5 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Paid by
                </th>
                <th className="px-3 py-2.5 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {showProjectColumn ? 'Project' : 'Description'}
                </th>
                <th className="px-3 py-2.5 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Tax
                </th>
                <th className="px-3 py-2.5 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Amount
                </th>
                <th className="w-px px-2 py-2.5" aria-label="Receipt" />
                <th className="w-px px-2 py-2.5 pr-4" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const editHref = e.project_id
                  ? `/projects/${e.project_id}?tab=costs`
                  : (editHrefForOverhead?.(e.id) ?? `/expenses/${e.id}/edit`);
                const catLabel = e.parent_category_name
                  ? `${e.parent_category_name} › ${e.category_name}`
                  : (e.category_name ?? '—');
                const isSelectable = !e.project_id;
                const isSelected = selected.has(e.id);
                return (
                  <tr
                    key={e.id}
                    className={`group border-b last:border-0 ${isSelected ? 'bg-brand/5' : 'hover:bg-muted/40'}`}
                  >
                    <td className="px-3 py-3 pl-4">
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        disabled={!isSelectable}
                        checked={isSelected}
                        onChange={(ev) => toggleOne(e.id, ev.target.checked)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <Link
                        href={editHref}
                        className="font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                      >
                        {formatDateShort(e.expense_date, { timezone: tz })}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {e.category_id ? (
                        <Link href={editHref} className="hover:underline">
                          {catLabel}
                        </Link>
                      ) : (
                        <Link
                          href={editHref}
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-200/70 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        >
                          <Tag aria-hidden className="size-3" />
                          Uncategorized
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {e.vendor ? e.vendor : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      {e.payment_source ? (
                        <PaymentSourcePill source={e.payment_source} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {showProjectColumn ? (
                      <td className="px-3 py-3 text-muted-foreground">
                        {e.project_id ? (
                          <Link
                            href={`/projects/${e.project_id}`}
                            className="text-xs hover:underline"
                          >
                            project →
                          </Link>
                        ) : (
                          <span className="text-xs">general overhead</span>
                        )}
                      </td>
                    ) : (
                      <td className="max-w-md truncate px-3 py-3 text-muted-foreground">
                        {e.description ?? '—'}
                      </td>
                    )}
                    <td className="px-3 py-3 text-right">
                      {e.tax_cents > 0 ? (
                        <Money
                          cents={e.tax_cents}
                          symbol={false}
                          className="text-muted-foreground"
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Money cents={e.amount_cents} emphasis />
                    </td>
                    <td className="px-2 py-3 text-right">
                      <ReceiptPreviewButton
                        url={e.receipt_signed_url}
                        mimeHint={e.receipt_mime_hint}
                        vendor={e.vendor}
                      />
                    </td>
                    <td className="px-2 py-3 pr-4 text-right">
                      {isSelectable ? (
                        <DeleteExpenseButton
                          id={e.id}
                          label={e.vendor ?? e.description ?? 'this expense'}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {footer}
      </div>

      {selected.size > 0 ? (
        <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-2 rounded-full border bg-background px-4 py-2 shadow-lg">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide tabular-nums">
            {selected.size} selected
          </span>
          <span className="text-muted-foreground">·</span>
          <Button size="sm" variant="outline" onClick={() => setRecatOpen(true)} disabled={pending}>
            <Tag className="size-3.5" />
            Recategorize
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSourceOpen(true)}
            disabled={pending}
          >
            Set source
          </Button>
          <Button size="sm" variant="outline" onClick={runDelete} disabled={pending}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <Dialog open={sourceOpen} onOpenChange={setSourceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Set source on {selected.size} expense{selected.size === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              Pick the card or funding source. Project-linked rows and rows in locked periods are
              silently skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bulk-src">Paid by</Label>
            <select
              id="bulk-src"
              value={targetSource}
              onChange={(e) => setTargetSource(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Pick a source —</option>
              {paymentSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.last4 ? ` ····${s.last4}` : ''}
                  {s.is_default ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSourceOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={runSetSource} disabled={pending || !targetSource}>
              {pending ? 'Updating…' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recatOpen} onOpenChange={setRecatOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Recategorize {selected.size} expense{selected.size === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              Pick a category. Rows in locked periods are silently skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bulk-cat">Category</Label>
            <select
              id="bulk-cat"
              value={targetCategory}
              onChange={(e) => setTargetCategory(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Pick a category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} disabled={c.isParentHeader}>
                  {c.label}
                  {c.isParentHeader ? ' (sub-accounts below)' : ''}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRecatOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={runRecategorize} disabled={pending || !targetCategory}>
              {pending ? 'Updating…' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
