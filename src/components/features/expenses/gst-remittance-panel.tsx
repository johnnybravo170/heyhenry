'use client';

/**
 * GST/HST remittance UI.
 *
 * Three breakdown surfaces on the ITC side:
 *   - Overhead expenses, grouped by category
 *   - Project work (expenses + bills combined), grouped by project
 *   - Single "filed" indicator if the current period has been marked paid
 *
 * Filing flow: operator / bookkeeper opens the mark-filed dialog, types
 * in the amount they sent to CRA + date + optional confirmation ref,
 * we persist a gst_remittances row. Future visits to this period show
 * "Filed YYYY-MM-DD" instead of the "Net owed" card.
 */

import { CheckCircle2, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { GstRemittanceReport, RemittancePeriod } from '@/lib/db/queries/gst-remittance';
import { formatCurrency } from '@/lib/pricing/calculator';
import {
  markGstRemittancePaidAction,
  unmarkGstRemittanceAction,
} from '@/server/actions/gst-remittance';

type Preset = { key: string; label: string; period: RemittancePeriod };

type Props = {
  report: GstRemittanceReport;
  presets: Preset[];
  activeFrom: string;
  activeTo: string;
  taxLabel: string;
  basePath?: string;
  backHref?: string | null;
};

function dollarsToCents(s: string): number {
  const cleaned = s.replace(/[^\d.-]/g, '');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
function centsToDollars(c: number): string {
  return (c / 100).toFixed(2);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GstRemittancePanel({
  report,
  presets,
  activeFrom,
  activeTo,
  taxLabel,
  basePath = '/expenses/gst',
  backHref = '/expenses',
}: Props) {
  const router = useRouter();
  const [customFrom, setCustomFrom] = useState(activeFrom);
  const [customTo, setCustomTo] = useState(activeTo);
  const [fileDialog, setFileDialog] = useState(false);
  const [pending, startTransition] = useTransition();

  function applyPeriod(from: string, to: string) {
    const params = new URLSearchParams();
    params.set('from', from);
    params.set('to', to);
    router.push(`${basePath}?${params.toString()}`);
  }

  const activePreset = presets.find(
    (p) => p.period.from === activeFrom && p.period.to === activeTo,
  );

  const net = report.net_owed_cents;
  const owesGovernment = net > 0;
  const filed = report.filed;

  function unmark() {
    if (!filed) return;
    if (!confirm(`Unmark this period as filed? You can re-record afterward if it was a mistake.`))
      return;
    startTransition(async () => {
      const res = await unmarkGstRemittanceAction({ id: filed.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Period unmarked');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Preset pills + custom range */}
      <div className="flex flex-col gap-4 rounded-md border bg-muted/10 p-4">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const isActive = activePreset?.key === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPeriod(p.period.from, p.period.to)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  isActive
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-input hover:bg-muted'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="gst-from" className="text-xs">
              From
            </Label>
            <Input
              id="gst-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="gst-to" className="text-xs">
              To
            </Label>
            <Input
              id="gst-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => applyPeriod(customFrom, customTo)}
            disabled={!customFrom || !customTo || customFrom > customTo}
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Headline cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Collected on invoices"
          amount={report.collected.tax_cents}
          note={`${report.collected.invoice_count} paid invoice${report.collected.invoice_count === 1 ? '' : 's'}`}
          tone="neutral"
        />
        <StatCard
          label="Input Tax Credits (paid)"
          amount={report.paid_overhead.tax_cents + report.paid_project_work.tax_cents}
          note={`${report.paid_overhead.count} overhead · ${report.paid_project_work.expense_count} project expenses · ${report.paid_project_work.bill_count} bills`}
          tone="neutral"
        />
        {filed ? (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/40">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-300" />
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                Filed
              </p>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(filed.amount_cents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Paid {filed.paid_at}
              {filed.reference ? ` · ${filed.reference}` : ''}
            </p>
            <button
              type="button"
              onClick={unmark}
              disabled={pending}
              className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
            >
              Unmark
            </button>
          </div>
        ) : (
          <div
            className={`rounded-md border p-4 ${
              owesGovernment
                ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40'
                : 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40'
            }`}
          >
            <p className="text-xs text-muted-foreground">
              {owesGovernment ? 'Net owed to CRA' : 'Net refund due'}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(Math.abs(net))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {owesGovernment ? 'File + remit this' : 'Claim on return'}
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => setFileDialog(true)}
            >
              Mark as filed
            </Button>
          </div>
        )}
      </div>

      {/* Overhead breakdown by category */}
      <BreakdownSection
        title={`Overhead expenses · ${taxLabel} paid`}
        total={report.paid_overhead.tax_cents}
        exportHref={`/api/expenses/gst-remittance-csv?from=${activeFrom}&to=${activeTo}`}
      >
        {report.paid_overhead.by_category.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No overhead tax recorded in this period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left font-medium">Category</th>
                <th className="px-4 py-2 text-right font-medium">Pre-tax subtotal</th>
                <th className="px-4 py-2 text-right font-medium">ITC (GST/HST)</th>
              </tr>
            </thead>
            <tbody>
              {report.paid_overhead.by_category.map((line) => (
                <tr key={line.category_id ?? 'none'} className="border-b last:border-0">
                  <td className="px-4 py-2">{line.category_label}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(line.amount_cents)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {formatCurrency(line.tax_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </BreakdownSection>

      {/* Project-linked breakdown by project */}
      <BreakdownSection
        title={`Project work · ${taxLabel} paid`}
        total={report.paid_project_work.tax_cents}
      >
        {report.paid_project_work.by_project.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No project-linked tax recorded in this period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left font-medium">Project</th>
                <th className="px-4 py-2 text-right font-medium">Expenses</th>
                <th className="px-4 py-2 text-right font-medium">Bills</th>
                <th className="px-4 py-2 text-right font-medium">Pre-tax subtotal</th>
                <th className="px-4 py-2 text-right font-medium">ITC (GST/HST)</th>
              </tr>
            </thead>
            <tbody>
              {report.paid_project_work.by_project.map((line) => (
                <tr key={line.project_id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/projects/${line.project_id}`} className="hover:underline">
                      {line.project_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {line.expense_count}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {line.bill_count}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(line.amount_cents)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {formatCurrency(line.tax_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </BreakdownSection>

      <p className="text-xs text-muted-foreground">
        {backHref ? (
          <>
            <Link href={backHref} className="hover:underline">
              ← Back to expenses
            </Link>
            {' · '}
          </>
        ) : null}
        Tax figures come from what&apos;s stored on each record, not re-computed from rates. If an
        expense is missing its tax amount, it won&apos;t show up as an ITC here.
      </p>

      <MarkFiledDialog
        open={fileDialog}
        onOpenChange={setFileDialog}
        periodFrom={activeFrom}
        periodTo={activeTo}
        suggestedAmountCents={net}
        onFiled={() => router.refresh()}
      />
    </div>
  );
}

function BreakdownSection({
  title,
  total,
  exportHref,
  children,
}: {
  title: string;
  total: number;
  exportHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <h2 className="text-sm font-medium">
          {title} · <span className="tabular-nums">{formatCurrency(total)}</span>
        </h2>
        {exportHref ? (
          <a
            href={exportHref}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="size-3.5" />
            CSV
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  amount,
  note,
  tone,
}: {
  label: string;
  amount: number;
  note: string;
  tone: 'neutral' | 'warning' | 'good';
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40'
      : tone === 'good'
        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40'
        : 'bg-card';
  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(amount)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function MarkFiledDialog({
  open,
  onOpenChange,
  periodFrom,
  periodTo,
  suggestedAmountCents,
  onFiled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodFrom: string;
  periodTo: string;
  suggestedAmountCents: number;
  onFiled: () => void;
}) {
  const [amount, setAmount] = useState(centsToDollars(Math.max(0, suggestedAmountCents)));
  const [paidAt, setPaidAt] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await markGstRemittancePaidAction({
        period_from: periodFrom,
        period_to: periodTo,
        amount_cents: dollarsToCents(amount),
        paid_at: paidAt,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Filing recorded');
      onOpenChange(false);
      onFiled();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark as filed</DialogTitle>
          <DialogDescription>
            Record that you&apos;ve filed + paid CRA for <strong>{periodFrom}</strong> through{' '}
            <strong>{periodTo}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file-amount">Amount paid</Label>
            <Input
              id="file-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Pre-filled from net owed. Override if you actually paid a different amount.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file-paid-at">Paid on</Label>
            <Input
              id="file-paid-at"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file-ref">Reference (optional)</Label>
            <Input
              id="file-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="CRA confirmation number"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file-notes">Notes (optional)</Label>
            <Textarea
              id="file-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything worth remembering for next quarter"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Record filing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
