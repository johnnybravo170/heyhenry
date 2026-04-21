'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { InvoiceStatusBadge } from '@/components/features/worker/worker-invoice-status-badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { WorkerInvoiceRow } from '@/lib/db/queries/worker-invoices';
import { formatCurrency } from '@/lib/pricing/calculator';
import {
  approveWorkerInvoiceAction,
  markWorkerInvoicePaidAction,
  rejectWorkerInvoiceAction,
} from '@/server/actions/worker-invoices';

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
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        No worker invoices for this project.
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border text-sm">
      {invoices.map((inv) => {
        const isRejecting = rejectingId === inv.id;
        const busy = pendingId === inv.id && isPending;
        return (
          <div key={inv.id} className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
              <InvoiceStatusBadge status={inv.status} />
              <span className="font-medium">{inv.worker_name ?? 'Worker'}</span>
              <span className="text-muted-foreground">
                {inv.period_start} → {inv.period_end}
              </span>
              <span className="ml-auto font-medium">{formatCurrency(inv.total_cents)}</span>
            </div>
            {inv.notes ? (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap">{inv.notes}</div>
            ) : null}
            {inv.rejection_reason ? (
              <div className="text-xs text-red-700">Rejected: {inv.rejection_reason}</div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {inv.status === 'submitted' ? (
                <>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => runAction(inv.id, () => approveWorkerInvoiceAction(inv.id))}
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
                  onClick={() => runAction(inv.id, () => markWorkerInvoicePaidAction(inv.id))}
                >
                  {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  Mark paid
                </Button>
              ) : null}
            </div>

            {isRejecting ? (
              <div className="flex flex-col gap-2 rounded border bg-muted/20 p-2">
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
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
