'use client';

/**
 * Billing/AR list — project-grouped expandable rows (desktop) + cards (mobile).
 *
 * Each project shows its billing position (Contract → Billed → Paid →
 * Outstanding → Remaining) + a status-rollup chip. Expanding reveals the
 * individual draws/invoices with per-row money actions (Mark paid on unpaid,
 * Send reminder on overdue). Ready-to-bill projects carry a peach Henry prompt
 * that hands off to the project's draw-creation flow.
 *
 * Rust is the single accent — reserved for the ready-to-bill prompt + its
 * action button. Overdue uses danger red. Cents are de-emphasized everywhere
 * (the shared <Money> component). Sort/grouping is server-side (action-first).
 */

import { ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { RecordPaymentDialog } from '@/components/features/invoices/record-payment-dialog';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import type { BillingInvoice, BillingProjectPosition } from '@/lib/db/queries/billing';
import { statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import { BillingStatusBadge } from './billing-status-badge';
import { DrawReminder } from './draw-reminder';

/** Whole-dollar compact for chips/prompts (matches the OD — no cents). */
function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-CA')}`;
}

/** Display label for a stored payment method (Interac e-Transfer at parity). */
const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  'e-transfer': 'Interac',
  stripe: 'Card',
  other: 'Other',
};
function methodLabel(method: string | null): string | null {
  if (!method) return null;
  return METHOD_LABELS[method] ?? method;
}

const POS_LABELS = ['Contract', 'Billed', 'Paid', 'Outstanding', 'Remaining'] as const;

export function BillingTable({ positions }: { positions: BillingProjectPosition[] }) {
  const tz = useTenantTimezone();
  // Default-open projects that need attention (have an overdue draw).
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(positions.filter((p) => p.overdue_count > 0).map((p) => p.project_id)),
  );

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  }

  return (
    <>
      {/* ── Desktop table ── */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        {/* Column header */}
        <div className="grid grid-cols-[30px_minmax(220px,1.1fr)_minmax(440px,1.6fr)_160px] items-center gap-4 border-b px-5 py-3">
          <div />
          <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Project
          </div>
          <div className="grid grid-cols-5 gap-2">
            {POS_LABELS.map((l) => (
              <div
                key={l}
                className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {l}
              </div>
            ))}
          </div>
          <div className="text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </div>
        </div>

        {positions.map((p) => {
          const isOpen = open.has(p.project_id);
          return (
            <div key={p.project_id} className="border-b last:border-0">
              <button
                type="button"
                onClick={() => toggle(p.project_id)}
                aria-expanded={isOpen}
                className={cn(
                  'grid w-full grid-cols-[30px_minmax(220px,1.1fr)_minmax(440px,1.6fr)_160px] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent',
                  isOpen && 'bg-accent',
                )}
              >
                <ChevronRight
                  aria-hidden
                  className={cn(
                    'size-4 text-muted-foreground transition-transform',
                    isOpen && 'rotate-90',
                  )}
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{p.project_name}</div>
                  {p.customer ? (
                    <div className="truncate text-sm text-muted-foreground">
                      {p.customer.name}
                      {p.region ? (
                        <span className="text-muted-foreground/70"> · {p.region}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <PositionRow p={p} />
                <div className="flex justify-end">
                  <RollupChip p={p} />
                </div>
              </button>

              {/* Ready-to-bill Henry prompt (peach). */}
              {p.ready_to_bill ? (
                <div className="mb-3 ml-[76px] mr-5 flex items-center gap-3 rounded-lg border border-brand/25 border-l-[3px] border-l-brand bg-[#FEF0E3] px-3.5 py-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-md bg-card text-brand">
                    <Sparkles className="size-3" aria-hidden />
                  </span>
                  <p className="flex-1 text-sm text-foreground">
                    <span className="mr-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-brand">
                      Henry
                    </span>
                    <strong className="font-semibold">{dollars(p.ready_to_bill_cents)}</strong> left
                    on contract — start the next draw?
                  </p>
                  <Button asChild size="xs" className="bg-brand text-white hover:bg-brand/90">
                    <Link href={`/projects/${p.project_id}?tab=invoices`}>
                      Bill draw — {dollars(p.ready_to_bill_cents)}
                    </Link>
                  </Button>
                </div>
              ) : null}

              {/* Expanded draws/invoices. */}
              {isOpen ? <Draws p={p} fmtDate={fmtDate} /> : null}
            </div>
          );
        })}
      </div>

      {/* ── Mobile cards ── */}
      <div className="flex flex-col gap-2 md:hidden">
        {positions.map((p) => {
          const isOpen = open.has(p.project_id);
          return (
            <div key={p.project_id} className="overflow-hidden rounded-xl border bg-card">
              <button
                type="button"
                onClick={() => toggle(p.project_id)}
                aria-expanded={isOpen}
                className={cn(
                  'flex w-full items-center gap-2 p-4 text-left',
                  isOpen && 'sticky top-0 z-10 border-b bg-card',
                )}
              >
                <ChevronRight
                  aria-hidden
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform',
                    isOpen && 'rotate-90',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.project_name}</div>
                  {p.customer ? (
                    <div className="truncate text-sm text-muted-foreground">
                      {p.customer.name}
                      {p.region ? (
                        <span className="text-muted-foreground/70"> · {p.region}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <RollupChip p={p} />
              </button>

              {isOpen ? (
                <div className="flex flex-col gap-3 px-4 pb-4">
                  {/* (1) Billing position */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/40 p-3">
                    <PositionStat label="Contract" cents={p.contract_cents} />
                    <PositionStat label="Billed" cents={p.billed_cents} />
                    <PositionStat label="Paid" cents={p.paid_cents} />
                    <PositionStat label="Outstanding" cents={p.outstanding_cents} />
                    <PositionStat label="Remaining" cents={p.remaining_cents} />
                  </div>

                  {/* Ready-to-bill Henry prompt (peach) — text line + action. */}
                  {p.ready_to_bill ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-brand/25 border-l-[3px] border-l-brand bg-[#FEF0E3] p-3">
                      <p className="flex items-start gap-2 text-sm text-foreground">
                        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-card text-brand">
                          <Sparkles className="size-3" aria-hidden />
                        </span>
                        <span>
                          <span className="mr-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-brand">
                            Henry
                          </span>
                          <strong className="font-semibold">
                            {dollars(p.ready_to_bill_cents)}
                          </strong>{' '}
                          left on contract — start the next draw?
                        </span>
                      </p>
                      <Button
                        asChild
                        size="sm"
                        className="w-full bg-brand text-white hover:bg-brand/90"
                      >
                        <Link href={`/projects/${p.project_id}?tab=invoices`}>
                          Bill draw — {dollars(p.ready_to_bill_cents)}
                        </Link>
                      </Button>
                    </div>
                  ) : null}

                  {/* (2) Draws / invoices */}
                  <Draws p={p} fmtDate={fmtDate} mobile />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PositionRow({ p }: { p: BillingProjectPosition }) {
  const values: (number | null)[] = [
    p.contract_cents,
    p.billed_cents,
    p.paid_cents,
    p.outstanding_cents,
    p.remaining_cents,
  ];
  return (
    <div className="grid grid-cols-5 items-end gap-2">
      {POS_LABELS.map((label, i) => {
        const v = values[i];
        const zero = v === 0;
        return (
          <div key={label} className="flex flex-col gap-0.5 border-r pr-2 last:border-r-0">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            {v === null ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              <Money
                cents={v}
                className={cn('text-sm font-semibold', zero && 'font-normal text-muted-foreground')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PositionStat({ label, cents }: { label: string; cents: number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {cents === null ? (
        <span className="text-sm text-muted-foreground">—</span>
      ) : (
        <Money
          cents={cents}
          className={cn(
            'text-sm font-semibold',
            cents === 0 && 'font-normal text-muted-foreground',
          )}
        />
      )}
    </div>
  );
}

function RollupChip({ p }: { p: BillingProjectPosition }) {
  const base =
    'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums';
  if (p.overdue_count > 0) {
    return <span className={cn(base, statusToneClass.danger)}>{p.overdue_count} overdue</span>;
  }
  if (p.ready_to_bill) {
    return (
      <span className={cn(base, 'border border-brand/20 bg-[#FEF0E3] text-brand')}>
        Ready to bill {dollars(p.ready_to_bill_cents)}
      </span>
    );
  }
  if (p.outstanding_cents > 0) {
    return (
      <span className={cn(base, statusToneClass.info)}>
        {dollars(p.outstanding_cents)} outstanding
      </span>
    );
  }
  if (p.billed_cents > 0 && (p.remaining_cents === null || p.remaining_cents <= 0)) {
    return <span className={cn(base, statusToneClass.success)}>Paid in full</span>;
  }
  if (p.invoices.some((i) => i.status === 'draft')) {
    return <span className={cn(base, statusToneClass.neutral)}>Draft</span>;
  }
  return null;
}

function Draws({
  p,
  fmtDate,
  mobile,
}: {
  p: BillingProjectPosition;
  fmtDate: (iso: string | null) => string;
  mobile?: boolean;
}) {
  // Running draw index (oldest first) so "Draw 1, 2…" reads like a schedule.
  const drawOrder = [...p.invoices]
    .filter((i) => i.doc_type === 'draw')
    .sort((a, b) => (a.sent_at ?? a.paid_at ?? '').localeCompare(b.sent_at ?? b.paid_at ?? ''));
  const drawIndex = new Map(drawOrder.map((d, i) => [d.id, i + 1]));
  const drawCount = drawOrder.length;

  return (
    <div className={cn('border-t bg-muted/30', mobile ? 'rounded-lg' : 'py-1 pl-[76px] pr-5')}>
      <div className="py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {drawCount > 0 ? `Draws · ${drawCount}` : 'Invoices'}
      </div>
      {p.invoices.map((inv) => (
        <DrawRow
          key={inv.id}
          inv={inv}
          label={inv.doc_type === 'draw' ? `Draw ${drawIndex.get(inv.id) ?? ''}`.trim() : 'Invoice'}
          customerName={p.customer?.name ?? null}
          fmtDate={fmtDate}
          mobile={mobile}
        />
      ))}
    </div>
  );
}

function DrawRow({
  inv,
  label,
  customerName,
  fmtDate,
  mobile,
}: {
  inv: BillingInvoice;
  label: string;
  customerName: string | null;
  fmtDate: (iso: string | null) => string;
  mobile?: boolean;
}) {
  const gst =
    inv.tax_cents > 0 ? `${inv.tax_inclusive ? 'incl.' : '+'} ${dollars(inv.tax_cents)} GST` : null;

  const info =
    inv.status === 'paid'
      ? `paid ${fmtDate(inv.paid_at)}${methodLabel(inv.payment_method) ? ` · ${methodLabel(inv.payment_method)}` : ''}`
      : inv.is_overdue
        ? `sent ${fmtDate(inv.sent_at)} · no payment received`
        : inv.status === 'sent'
          ? `sent ${fmtDate(inv.sent_at)} · awaiting payment`
          : 'draft';

  const unpaidSent = inv.status === 'sent';
  const action = unpaidSent ? (
    <div className="flex flex-col items-end gap-1.5">
      {inv.is_overdue ? <DrawReminder invoiceId={inv.id} customerName={customerName} /> : null}
      <RecordPaymentDialog
        invoiceId={inv.id}
        invoiceTotalCents={inv.total_cents}
        trigger={
          <Button type="button" variant="outline" size="xs">
            Mark paid
          </Button>
        }
      />
    </div>
  ) : null;

  if (mobile) {
    return (
      <div className="flex items-center justify-between gap-2 border-t border-dashed py-2.5 first:border-t-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{label}</span>
            <BillingStatusBadge
              status={inv.status}
              isOverdue={inv.is_overdue}
              overdueDays={inv.overdue_days}
            />
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">#{inv.id.slice(0, 8)}</div>
          <div className="text-xs text-muted-foreground">{info}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Money cents={inv.total_cents} className="text-sm font-semibold" />
          {action}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(140px,1fr)_110px_130px_120px_minmax(160px,1.1fr)_140px] items-center gap-3 border-t border-dashed py-2.5 text-sm first:border-t-0">
      <div className="font-semibold">{label}</div>
      <div className="font-mono text-xs text-muted-foreground">#{inv.id.slice(0, 8)}</div>
      <div className="flex flex-col text-right">
        <Money cents={inv.total_cents} className="text-sm font-semibold" />
        {gst ? <span className="font-mono text-[11px] text-muted-foreground">{gst}</span> : null}
      </div>
      <div>
        <BillingStatusBadge
          status={inv.status}
          isOverdue={inv.is_overdue}
          overdueDays={inv.overdue_days}
        />
      </div>
      <div className="text-muted-foreground">{info}</div>
      <div className="flex justify-end">{action}</div>
    </div>
  );
}
