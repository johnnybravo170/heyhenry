'use client';

/**
 * Multi-category split UI for expense forms. Replaces the single category
 * picker when the operator needs to assign one receipt to more than one
 * budget category.
 *
 * The parent holds an ExpenseSplit[] and passes it in/out via value/onChange.
 * grossCents on each row is this split's share of the total receipt amount
 * (tax-inclusive). GST is distributed proportionally by the server action.
 *
 * Used by: QuickLogExpenseButton, ReceiptForm (project-costs-section),
 *           StagedBillConfirmDialog.
 */

import { Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type ExpenseSplit = {
  id: string;
  budgetCategoryId: string;
  grossCents: number;
};

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function displayToCents(s: string): number {
  const n = Number.parseFloat(s.replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function ExpenseSplitRows({
  categories,
  totalGrossCents,
  value,
  onChange,
  disabled,
}: {
  categories: Array<{ id: string; name: string }>;
  totalGrossCents: number;
  value: ExpenseSplit[];
  onChange: (splits: ExpenseSplit[]) => void;
  disabled?: boolean;
}) {
  // Raw amount strings per row id — avoids re-formatting while the user
  // is mid-type (e.g. "80." shouldn't snap to "80.00" on every keystroke).
  const [rawAmounts, setRawAmounts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const r of value) {
      init[r.id] = r.grossCents > 0 ? centsToDisplay(r.grossCents) : '';
    }
    return init;
  });

  // Track insertion order explicitly so we can give the last row's amount
  // field a useful "remaining" placeholder.
  const orderRef = useRef<string[]>(value.map((r) => r.id));

  function updateCategory(id: string, budgetCategoryId: string) {
    onChange(value.map((r) => (r.id === id ? { ...r, budgetCategoryId } : r)));
  }

  function updateAmount(id: string, raw: string) {
    setRawAmounts((prev) => ({ ...prev, [id]: raw }));
    const grossCents = displayToCents(raw);
    onChange(value.map((r) => (r.id === id ? { ...r, grossCents } : r)));
  }

  function removeRow(id: string) {
    orderRef.current = orderRef.current.filter((x) => x !== id);
    setRawAmounts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    onChange(value.filter((r) => r.id !== id));
  }

  function addRow() {
    const allocated = value.reduce((sum, r) => sum + r.grossCents, 0);
    const remaining = Math.max(0, totalGrossCents - allocated);
    const id = crypto.randomUUID();
    orderRef.current = [...orderRef.current, id];
    const raw = remaining > 0 ? centsToDisplay(remaining) : '';
    setRawAmounts((prev) => ({ ...prev, [id]: raw }));
    onChange([...value, { id, budgetCategoryId: '', grossCents: remaining }]);
  }

  const allocatedCents = value.reduce((sum, r) => sum + r.grossCents, 0);
  const remainingCents = totalGrossCents - allocatedCents;
  const isBalanced = remainingCents === 0 && value.length >= 2;
  const hasOverflow = remainingCents < 0;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Split by category</div>
      {value.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Select
              value={row.budgetCategoryId}
              onValueChange={(v) => updateCategory(row.id, v)}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Category (optional)" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28 shrink-0">
            <Input
              type="number"
              step="0.01"
              value={rawAmounts[row.id] ?? ''}
              onChange={(e) => updateAmount(row.id, e.target.value)}
              placeholder="0.00"
              disabled={disabled}
              className="h-8 text-right text-sm"
            />
          </div>
          {value.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => removeRow(row.id)}
              disabled={disabled}
            >
              <X className="size-3.5" />
            </Button>
          )}
          {value.length === 1 && <div className="w-8 shrink-0" />}
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addRow}
          disabled={disabled}
          className="h-7 gap-1 px-2 text-xs"
        >
          <Plus className="size-3" />
          Add split
        </Button>
        {totalGrossCents > 0 && (
          <span
            className={cn(
              'text-xs',
              isBalanced
                ? 'text-emerald-600 dark:text-emerald-400'
                : hasOverflow
                  ? 'font-medium text-destructive'
                  : 'text-muted-foreground',
            )}
          >
            {isBalanced
              ? 'Balanced'
              : hasOverflow
                ? `Over by $${centsToDisplay(Math.abs(remainingCents))}`
                : `$${centsToDisplay(remainingCents)} unallocated`}
          </span>
        )}
      </div>
    </div>
  );
}
