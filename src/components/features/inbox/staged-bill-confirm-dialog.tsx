'use client';

/**
 * Confirm dialog for a vendor bill (or overhead expense) staged in the
 * universal inbox.
 *
 * Pre-fills from OCR / email extraction, lets the operator edit anything
 * off, then routes to either:
 *   - Project bill   → applyIntakeIntentAction intent='vendor_bill'
 *   - Overhead       → applyIntakeIntentAction intent='overhead_expense'
 *
 * Mode toggle matches the QuickLogExpenseButton so the two surfaces feel
 * consistent. The same pre-filled vendor / amount / date / GST flows
 * through to both modes.
 */

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  type ExpenseSplit,
  ExpenseSplitRows,
} from '@/components/features/expenses/expense-split-rows';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { listExpenseCategoryOptionsAction } from '@/server/actions/expenses';
import { applyIntakeIntentAction } from '@/server/actions/inbox-intake';

export type StagedBillExtracted = {
  vendor?: string;
  vendor_gst_number?: string;
  bill_number?: string;
  bill_date?: string;
  description?: string;
  amount_cents?: number;
  cost_code?: string;
};

type Mode = 'project' | 'overhead';
type ProjectOption = { id: string; name: string };
type BudgetCategoryOption = { id: string; name: string };
type OverheadCategoryOption = { id: string; label: string; isParentHeader: boolean };

function dollarsToCents(s: string): number {
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function centsToDollars(c: number | null | undefined): string {
  if (c == null) return '';
  return (c / 100).toFixed(2);
}

function todayISO(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

export function StagedBillConfirmDialog({
  open,
  onOpenChange,
  draftId,
  extracted,
  projects,
  defaultProjectId,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  draftId: string;
  extracted: StagedBillExtracted | null;
  projects: ProjectOption[];
  defaultProjectId: string | null;
  onApplied: () => void;
}) {
  const tenantTz = useTenantTimezone();
  const [pending, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>('project');

  // Shared fields
  const [vendor, setVendor] = useState(extracted?.vendor ?? '');
  const [vendorGst, setVendorGst] = useState(extracted?.vendor_gst_number ?? '');
  const [billDate, setBillDate] = useState(extracted?.bill_date ?? todayISO(tenantTz));
  const [amount, setAmount] = useState(centsToDollars(extracted?.amount_cents));
  const [gst, setGst] = useState('');
  const [description, setDescription] = useState(extracted?.description ?? '');

  // Derived cents — used in both handleSubmit and JSX (split validation / total).
  const amountCents = dollarsToCents(amount);
  const gstCents = dollarsToCents(gst);

  // Project mode
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [categoryId, setCategoryId] = useState<string>('');
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryOption[]>([]);
  const [loadingBudgetCategories, setLoadingBudgetCategories] = useState(false);
  // null = single category; array = split mode
  const [splits, setSplits] = useState<ExpenseSplit[] | null>(null);

  // Overhead mode
  const [overheadCategoryId, setOverheadCategoryId] = useState('');
  const [overheadCategories, setOverheadCategories] = useState<OverheadCategoryOption[]>([]);

  // Load overhead categories once on mount.
  useEffect(() => {
    listExpenseCategoryOptionsAction().then((res) => {
      if (res.ok) setOverheadCategories(res.options);
    });
  }, []);

  // Load budget categories when project changes.
  useEffect(() => {
    if (!projectId) {
      setBudgetCategories([]);
      setCategoryId('');
      return;
    }
    let cancelled = false;
    setLoadingBudgetCategories(true);
    const supabase = createClient();
    supabase
      .from('project_budget_categories')
      .select('id, name')
      .eq('project_id', projectId)
      .order('display_order')
      .then(({ data }) => {
        if (cancelled) return;
        setBudgetCategories(((data ?? []) as { id: string; name: string }[]) ?? []);
        setLoadingBudgetCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (amountCents <= 0) {
      toast.error('Amount must be greater than zero.');
      return;
    }

    if (mode === 'project') {
      if (!projectId) {
        toast.error('Pick a project.');
        return;
      }
      if (!vendor.trim()) {
        toast.error('Vendor is required.');
        return;
      }
      if (splits && splits.length >= 2) {
        const totalGross = amountCents + gstCents;
        const splitSum = splits.reduce((s, r) => s + r.grossCents, 0);
        if (splitSum !== totalGross) {
          toast.error('Splits must total the bill amount before applying.');
          return;
        }
      }
      startTransition(async () => {
        const result = await applyIntakeIntentAction({
          draftId,
          intent: 'vendor_bill',
          projectId,
          fields: {
            vendor: vendor.trim(),
            vendorGstNumber: vendorGst.trim() || undefined,
            billDate,
            amountCents,
            gstCents,
            description: description.trim() || undefined,
            budgetCategoryId: splits ? undefined : categoryId || undefined,
            splits:
              splits && splits.length >= 2
                ? splits.map((s) => ({
                    budgetCategoryId: s.budgetCategoryId || undefined,
                    grossCents: s.grossCents,
                  }))
                : undefined,
          },
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('Bill applied to project.');
        onApplied();
        onOpenChange(false);
      });
    } else {
      if (!overheadCategoryId) {
        toast.error('Pick a category.');
        return;
      }
      startTransition(async () => {
        const result = await applyIntakeIntentAction({
          draftId,
          intent: 'overhead_expense',
          fields: {
            categoryId: overheadCategoryId,
            amountCents,
            gstCents,
            vendor: vendor.trim() || undefined,
            vendorGstNumber: vendorGst.trim() || undefined,
            expenseDate: billDate,
            description: description.trim() || undefined,
          },
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('Logged as overhead expense.');
        onApplied();
        onOpenChange(false);
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm vendor bill</DialogTitle>
          <DialogDescription>
            Henry pre-filled what he could from the forwarded email. Adjust anything that looks off,
            then apply.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Mode toggle */}
          <div className="flex rounded-md border p-0.5">
            {(['project', 'overhead'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={pending}
                className={cn(
                  'flex-1 rounded py-1.5 text-sm font-medium transition-colors',
                  mode === m
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'project' ? 'Project bill' : 'Overhead expense'}
              </button>
            ))}
          </div>

          {mode === 'project' ? (
            <div>
              <Label htmlFor="bill-project">Project</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={pending}>
                <SelectTrigger id="bill-project">
                  <SelectValue placeholder="Pick project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label htmlFor="bill-overhead-cat">Category</Label>
              <Select
                value={overheadCategoryId}
                onValueChange={setOverheadCategoryId}
                disabled={pending}
              >
                <SelectTrigger id="bill-overhead-cat">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {overheadCategories.map((c) =>
                    c.isParentHeader ? (
                      <SelectItem key={c.id} value={c.id} disabled>
                        {c.label}
                      </SelectItem>
                    ) : (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="bill-vendor">Vendor</Label>
              <Input
                id="bill-vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Smith Painting"
                required={mode === 'project'}
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="bill-amount">Amount ($)</Label>
              <Input
                id="bill-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="bill-gst">GST/HST ($)</Label>
              <Input
                id="bill-gst"
                inputMode="decimal"
                value={gst}
                onChange={(e) => setGst(e.target.value)}
                placeholder="0.00"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="bill-date">Bill date</Label>
              <Input
                id="bill-date"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                required
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="bill-vendor-gst">Vendor GST #</Label>
              <Input
                id="bill-vendor-gst"
                value={vendorGst}
                onChange={(e) => setVendorGst(e.target.value)}
                placeholder="e.g. 123456789 RT0001"
                disabled={pending}
              />
            </div>
          </div>

          {mode === 'project' && (
            <div>
              {splits !== null ? (
                <>
                  <ExpenseSplitRows
                    categories={budgetCategories}
                    totalGrossCents={amountCents + gstCents}
                    value={splits}
                    onChange={setSplits}
                    disabled={pending}
                  />
                  <button
                    type="button"
                    onClick={() => setSplits(null)}
                    disabled={pending}
                    className="mt-1.5 text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Back to single category
                  </button>
                </>
              ) : (
                <>
                  <Label htmlFor="bill-category">Budget category</Label>
                  <Select
                    value={categoryId}
                    onValueChange={setCategoryId}
                    disabled={pending || !projectId || loadingBudgetCategories}
                  >
                    <SelectTrigger id="bill-category">
                      <SelectValue
                        placeholder={
                          !projectId
                            ? 'Pick a project first'
                            : loadingBudgetCategories
                              ? 'Loading…'
                              : 'Pick a category (optional)'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {budgetCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {projectId && budgetCategories.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const totalGross = amountCents + gstCents;
                        setSplits([
                          {
                            id: crypto.randomUUID(),
                            budgetCategoryId: categoryId,
                            grossCents: totalGross,
                          },
                          { id: crypto.randomUUID(), budgetCategoryId: '', grossCents: 0 },
                        ]);
                      }}
                      disabled={pending}
                      className="mt-1.5 text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Split across categories
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="bill-description">Description</Label>
            <Textarea
              id="bill-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes"
              rows={2}
              disabled={pending}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Applying…' : mode === 'project' ? 'Apply to project' : 'Log as overhead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
