'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { InvoiceStatusBadge } from '@/components/features/worker/worker-invoice-status-badge';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { Textarea } from '@/components/ui/textarea';
import type { WorkerInvoiceRow } from '@/lib/db/queries/worker-invoices';
import { cn } from '@/lib/utils';
import {
  approveWorkerInvoiceAction,
  markWorkerInvoicePaidAction,
  rejectWorkerInvoiceAction,
} from '@/server/actions/worker-invoices';

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
/** Format a date-only `YYYY-MM-DD` as "May 13". Parses the parts directly —
 *  no Date/Intl, so a date-only value never shifts across timezones (and
 *  doesn't trip the bare-toLocale lint). */
function fmtShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${SHORT_MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`;
}

export function WorkerInvoicesSection({ invoices }: { invoices: WorkerInvoiceRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [isPending, start] = useTransition();

  function runAction(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPendingId(id);
    start(async () => {
      const res = await fn();
      setPendingId(null);
      if (!res.ok) {
        toast.error(res.error ?? 'Action failed.');
        return;
      }
      toast.success('Done.');
      router.refresh();
    });
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        No worker invoices for this project.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-semibold">Status</th>
            <th className="px-4 py-2.5 text-left font-semibold">Worker / sub</th>
            <th className="px-4 py-2.5 text-left font-semibold">Period</th>
            <th className="px-4 py-2.5 text-right font-semibold">Subtotal</th>
            <th className="px-4 py-2.5 text-right font-semibold">GST</th>
            <th className="px-4 py-2.5 text-right font-semibold">Total</th>
            <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const isRejecting = rejectingId === inv.id;
            const busy = pendingId === inv.id && isPending;
            // Submitted invoices are the operator's approval queue — peach
            // tint so the awaiting rows read as the actionable ones.
            const awaiting = inv.status === 'submitted';
            return (
              <Fragment key={inv.id}>
                <tr className={cn('border-b last:border-0', awaiting && 'bg-[#FEF0E3]/40')}>
                  <td className="px-4 py-3 align-top">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="font-medium text-foreground">
                      {inv.worker_name ?? 'Worker'}
                    </span>
                    {inv.notes ? (
                      <span className="mt-0.5 block whitespace-pre-wrap text-xs text-muted-foreground">
                        {inv.notes}
                      </span>
                    ) : null}
                    {inv.rejection_reason ? (
                      <span className="mt-0.5 block text-xs text-red-700">
                        Rejected: {inv.rejection_reason}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {fmtShortDate(inv.period_start)} → {fmtShortDate(inv.period_end)}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <Money cents={inv.subtotal_cents} className="text-muted-foreground" />
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <Money cents={inv.tax_cents} className="text-muted-foreground" />
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <Money cents={inv.total_cents} emphasis />
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <div className="flex flex-wrap justify-end gap-1">
                      {inv.status === 'submitted' ? (
                        <>
                          <Button
                            size="sm"
                            className="bg-brand text-white hover:bg-brand/90"
                            disabled={busy}
                            onClick={() =>
                              runAction(inv.id, () => approveWorkerInvoiceAction(inv.id))
                            }
                          >
                            {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              setRejectingId(isRejecting ? null : inv.id);
                              setReason('');
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                      {inv.status === 'approved' ? (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            runAction(inv.id, () => markWorkerInvoicePaidAction(inv.id))
                          }
                        >
                          {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                          Mark paid
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                {isRejecting ? (
                  <tr className="border-b last:border-0 bg-[#FEF0E3]/40">
                    <td colSpan={7} className="px-4 pb-3">
                      <div className="flex flex-col gap-2 rounded-md border border-dashed border-red-300/60 bg-card p-3">
                        <Textarea
                          placeholder="Reason for rejection (shown to worker)"
                          rows={2}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={busy || !reason.trim()}
                            onClick={() =>
                              runAction(inv.id, async () => {
                                const r = await rejectWorkerInvoiceAction({ id: inv.id, reason });
                                if (r.ok) setRejectingId(null);
                                return r;
                              })
                            }
                          >
                            {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                            Confirm reject
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRejectingId(null)}
                            disabled={busy}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
