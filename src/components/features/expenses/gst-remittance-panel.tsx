'use client';

/**
 * GST/HST remittance UI (Paper restyle).
 *
 * The position reads Collected − ITCs = Net owed, big and calm — net-owed is
 * data, not an alarm. Two ITC breakdown surfaces: overhead-by-category and
 * project-by-project. The missing-BN list renders as a Henry warn-soft caution
 * card (rust ✦ eyebrow + warn-soft fill + rust left border) — the one real
 * CRA risk on this screen — never danger-red on a non-error.
 *
 * Filing flow unchanged: mark-filed dialog persists a gst_remittances row;
 * filed periods show a Filed card + Unmark. Every amount routes through
 * <Money>; dates through formatDate (tenant tz).
 */

import { AlertTriangle, Check, Download, Info, Loader2, Sparkles } from 'lucide-react';
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
import { Money } from '@/components/ui/money';
import { Textarea } from '@/components/ui/textarea';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import { formatDate } from '@/lib/date/format';
import type { GstRemittanceReport, RemittancePeriod } from '@/lib/db/queries/gst-remittance';
import { cn } from '@/lib/utils';
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
  const tz = useTenantTimezone();
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
  const itcCents = report.paid_overhead.tax_cents + report.paid_project_work.tax_cents;

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

  const csvHref = `/api/expenses/gst-remittance-csv?from=${activeFrom}&to=${activeTo}`;

  return (
    <div className="flex flex-col gap-5">
      {/* What this report is (and isn't) */}
      <div className="flex gap-3 rounded-xl border bg-card p-4 text-sm">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Info className="size-3.5" />
        </span>
        <div className="flex flex-col gap-1 text-muted-foreground">
          <p>
            <strong className="font-semibold text-foreground">
              This is a bookkeeping aid, not a CRA filing tool.
            </strong>{' '}
            HeyHenry doesn&apos;t file returns or send payments to CRA — your bookkeeper still
            handles that part. The numbers here give them (or you) everything needed for Form GST34
            in a few minutes instead of a few hours.
          </p>
          <p>
            Figures come from what&apos;s logged in HeyHenry. If a receipt is missing or a
            vendor&apos;s BN isn&apos;t captured, the ITC might not stand up on audit — clear the
            warnings below before handing off.
          </p>
        </div>
      </div>

      {/* Preset pills + custom range */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Period
        </span>
        {presets.map((p) => {
          const isActive = activePreset?.key === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPeriod(p.period.from, p.period.to)}
              aria-pressed={isActive}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                isActive
                  ? 'border-foreground bg-foreground font-medium text-background'
                  : 'border-input hover:bg-muted',
              )}
            >
              {p.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="gst-from" className="text-[11px] text-muted-foreground">
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
            <Label htmlFor="gst-to" className="text-[11px] text-muted-foreground">
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

      {/* The position — Collected − ITCs = Net owed (or the Filed card). */}
      <div className="rounded-xl border bg-card p-5">
        <p className="border-b border-dashed pb-3 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Filing period · {formatDate(activeFrom, { timezone: tz })} —{' '}
          {formatDate(activeTo, { timezone: tz })}
        </p>
        <div className="mt-4 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr_auto_1.2fr_auto]">
          <PositionBlock
            label="Collected on invoices"
            cents={report.collected.tax_cents}
            foot={`${report.collected.invoice_count} paid invoice${report.collected.invoice_count === 1 ? '' : 's'}`}
          />
          <span className="hidden self-center pt-5 font-mono text-xl text-muted-foreground/60 sm:block">
            −
          </span>
          <PositionBlock
            label="Input Tax Credits"
            cents={itcCents}
            foot={`${report.paid_overhead.count} overhead · ${report.paid_project_work.expense_count} project · ${report.paid_project_work.bill_count} bills`}
          />
          <span className="hidden self-center pt-5 font-mono text-xl text-muted-foreground/60 sm:block">
            =
          </span>

          {filed ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-700 dark:bg-emerald-950/40">
              <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                <Check className="size-3" /> Filed
              </span>
              <Money
                cents={filed.amount_cents}
                className="text-2xl text-emerald-800 dark:text-emerald-300"
                emphasis
              />
              <p className="text-xs text-muted-foreground">
                Paid {formatDate(filed.paid_at, { timezone: tz })}
                {filed.reference ? ` · ${filed.reference}` : ''}
              </p>
              <button
                type="button"
                onClick={unmark}
                disabled={pending}
                className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-emerald-700 underline underline-offset-2 disabled:opacity-50 dark:text-emerald-300"
              >
                Unmark
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {owesGovernment ? 'Net owed to CRA' : 'Net refund due'}
              </span>
              <Money cents={Math.abs(net)} className="text-4xl" emphasis />
              <span className="text-xs text-muted-foreground">
                {owesGovernment ? 'File + remit this' : 'Claim on return'}
              </span>
            </div>
          )}

          {!filed ? (
            <div className="flex flex-col gap-2 sm:items-stretch">
              <Button type="button" size="sm" onClick={() => setFileDialog(true)}>
                <Check className="size-3.5" />
                Mark as filed
              </Button>
              <Button asChild type="button" size="sm" variant="outline">
                <a href={csvHref}>
                  <Download className="size-3.5" />
                  Export CSV
                </a>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:items-stretch">
              <Button asChild type="button" size="sm" variant="outline">
                <a href={csvHref}>
                  <Download className="size-3.5" />
                  Export CSV
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Henry caution — missing BN (rust ✦ + warn-soft fill + rust left border) */}
      {report.missing_bn.length > 0 ? (
        <section
          className="flex flex-col gap-3 rounded-xl border border-l-[3px] border-amber-300/60 border-l-brand bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-950/20"
          aria-label="Missing vendor BN"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-card text-brand">
              <Sparkles className="size-3.5" />
            </span>
            <div className="flex-1">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand">
                ✦ Henry · CRA risk
              </span>{' '}
              <span className="font-semibold">
                {report.missing_bn.length} ITC claim{report.missing_bn.length === 1 ? '' : 's'}{' '}
                missing a vendor BN —{' '}
                <Money
                  cents={report.missing_bn.reduce((s, r) => s + r.tax_cents, 0)}
                  className="text-foreground"
                />{' '}
                at risk.
              </span>
              <p className="mt-1 text-sm text-foreground/80">
                CRA requires the vendor&apos;s GST/HST number on any invoice over $30 to claim the
                Input Tax Credit. Add the BN to each, or chase the vendor for an updated receipt
                before you file.
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-amber-300/40 bg-card dark:border-amber-700/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-300/30 bg-amber-100/40 dark:border-amber-700/30 dark:bg-amber-900/20">
                  <th className="px-4 py-2 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Vendor
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Where
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Date
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    GST/HST
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.missing_bn.map((row) => {
                  const href =
                    row.kind === 'expense' && !row.project_id
                      ? `/expenses/${row.id}/edit`
                      : row.project_id
                        ? `/projects/${row.project_id}?tab=costs`
                        : '#';
                  return (
                    <tr key={`${row.kind}-${row.id}`} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">
                        <Link href={href} className="hover:underline">
                          {row.vendor ?? '(no vendor)'}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {row.project_name
                          ? `${row.kind === 'bill' ? 'Bill' : 'Expense'} · ${row.project_name}`
                          : row.kind === 'bill'
                            ? 'Bill (project)'
                            : 'General overhead expense'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {formatDate(row.date, { timezone: tz })}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Money
                          cents={row.amount_cents}
                          symbol={false}
                          className="text-foreground"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Money
                          cents={row.tax_cents}
                          className="text-amber-700 dark:text-amber-300"
                          emphasis
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Overhead breakdown by category */}
      <BreakdownSection
        title={`General overhead · ${taxLabel} paid`}
        total={report.paid_overhead.tax_cents}
        exportHref={csvHref}
      >
        {report.paid_overhead.by_category.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No overhead tax recorded in this period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Category
                </th>
                <th className="px-4 py-2 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pre-tax subtotal
                </th>
                <th className="px-4 py-2 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  ITC ({taxLabel})
                </th>
              </tr>
            </thead>
            <tbody>
              {report.paid_overhead.by_category.map((line) => (
                <tr key={line.category_id ?? 'none'} className="border-b last:border-0">
                  <td className="px-4 py-2">{line.category_label}</td>
                  <td className="px-4 py-2 text-right">
                    <Money
                      cents={line.amount_cents}
                      symbol={false}
                      className="text-muted-foreground"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Money cents={line.tax_cents} emphasis />
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
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Project
                </th>
                <th className="px-4 py-2 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Expenses
                </th>
                <th className="px-4 py-2 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Bills
                </th>
                <th className="px-4 py-2 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pre-tax subtotal
                </th>
                <th className="px-4 py-2 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  ITC ({taxLabel})
                </th>
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
                  <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {line.expense_count}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {line.bill_count}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Money
                      cents={line.amount_cents}
                      symbol={false}
                      className="text-muted-foreground"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Money cents={line.tax_cents} emphasis />
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

function PositionBlock({ label, cents, foot }: { label: string; cents: number; foot: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Money cents={cents} className="text-2xl" emphasis />
      <span className="text-xs text-muted-foreground">{foot}</span>
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
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title} · <Money cents={total} className="text-foreground" emphasis />
        </h2>
        {exportHref ? (
          <a
            href={exportHref}
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            <Download className="size-3" />
            CSV
          </a>
        ) : null}
      </div>
      {children}
    </section>
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
