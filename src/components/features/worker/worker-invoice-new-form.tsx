'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import type { InvoiceExpenseLine, InvoiceTimeLine } from '@/lib/db/queries/worker-invoices';
import { formatCurrency } from '@/lib/pricing/calculator';
import { submitWorkerInvoiceAction } from '@/server/actions/worker-invoices';

type Project = { project_id: string; project_name: string };

type Preview = { time: InvoiceTimeLine[]; expenses: InvoiceExpenseLine[] };

type Props = {
  projects: Project[];
  defaultTaxRate: number;
  initialPreview: Preview;
  initialRange: { from: string; to: string };
};

export function WorkerInvoiceNewForm({
  projects,
  defaultTaxRate,
  initialPreview,
  initialRange,
}: Props) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>('');
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [taxRate, setTaxRate] = useState(String((defaultTaxRate * 100).toFixed(2)));
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<Preview>(initialPreview);
  const [loadingPreview, startPreview] = useTransition();
  const [submitting, startSubmit] = useTransition();

  useEffect(() => {
    const url = new URL('/api/worker/invoice-preview', window.location.origin);
    if (projectId) url.searchParams.set('project_id', projectId);
    url.searchParams.set('from', fromDate);
    url.searchParams.set('to', toDate);
    startPreview(async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as Preview;
        setPreview(json);
      } catch {
        // ignore — the submit path re-queries.
      }
    });
  }, [projectId, fromDate, toDate]);

  const subtotal =
    preview.time.reduce((s, r) => s + r.amount_cents, 0) +
    preview.expenses.reduce((s, r) => s + r.amount_cents, 0);
  const ratePct = Number(taxRate);
  const rate = Number.isFinite(ratePct) ? ratePct / 100 : 0;
  const taxCents = Math.round(subtotal * rate);
  const total = subtotal + taxCents;

  const canSubmit =
    preview.time.length + preview.expenses.length > 0 && fromDate && toDate && toDate >= fromDate;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      toast.error('Nothing to invoice in that range.');
      return;
    }
    startSubmit(async () => {
      const res = await submitWorkerInvoiceAction({
        project_id: projectId || null,
        period_start: fromDate,
        period_end: toDate,
        tax_rate: rate,
        notes: notes || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Invoice submitted.');
      router.push(`/w/invoices/${res.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="space-y-1.5">
        <Label htmlFor="project">Project (optional — all projects if blank)</Label>
        <Select
          value={projectId || 'all'}
          onValueChange={(v) => setProjectId(v === 'all' ? '' : v)}
        >
          <SelectTrigger id="project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.project_id} value={p.project_id}>
                {p.project_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">
          Preview {loadingPreview ? '(loading…)' : ''}
        </div>
        {preview.time.length === 0 && preview.expenses.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No unbilled time or expenses in that range.
          </p>
        ) : (
          <div className="divide-y text-sm">
            {preview.time.map((t) => (
              <div key={`t-${t.id}`} className="flex items-start justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div>
                    {t.entry_date} · {t.hours.toFixed(2)}h
                    {t.project_name ? ` · ${t.project_name}` : ''}
                  </div>
                  {t.notes ? <div className="text-xs text-muted-foreground">{t.notes}</div> : null}
                </div>
                <div className="text-right">
                  <div>{formatCurrency(t.amount_cents)}</div>
                  {t.charge_rate_cents == null ? (
                    <div className="text-[10px] text-amber-600">No rate set</div>
                  ) : null}
                </div>
              </div>
            ))}
            {preview.expenses.map((x) => (
              <div key={`x-${x.id}`} className="flex items-start justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div>
                    {x.expense_date} · expense
                    {x.vendor ? ` · ${x.vendor}` : ''}
                    {x.project_name ? ` · ${x.project_name}` : ''}
                  </div>
                  {x.description ? (
                    <div className="text-xs text-muted-foreground">{x.description}</div>
                  ) : null}
                </div>
                <div>{formatCurrency(x.amount_cents)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tax">Tax rate (%)</Label>
        <Input
          id="tax"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          max="100"
          value={taxRate}
          onChange={(e) => setTaxRate(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="rounded-lg border bg-muted/20 p-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax ({ratePct}%)</span>
          <span>{formatCurrency(taxCents)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <Button type="submit" disabled={submitting || !canSubmit} className="w-full">
        {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Submit invoice
      </Button>
    </form>
  );
}
