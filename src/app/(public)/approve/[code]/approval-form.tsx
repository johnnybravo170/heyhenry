'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { approveChangeOrderAction, declineChangeOrderAction } from '@/server/actions/change-orders';

/**
 * Customer-facing change-order approval. Rendered in the
 * `<CustomerDocument actionZone>` slot. Three states:
 *   pending → approve (typed-name e-signature) | decline (optional reason)
 *           → done
 *
 * CO keeps the decline path (decision: a CO is a discrete yes/no on a priced
 * change, unlike the estimate which is feedback-only to keep the GC in the
 * conversation).
 */
export function ApprovalForm({
  approvalCode,
  approveLabel,
}: {
  approvalCode: string;
  /** e.g. "Approve — +$3,341.63" */
  approveLabel: string;
}) {
  const [mode, setMode] = useState<'pending' | 'decline' | 'done'>('pending');
  const [name, setName] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState('');

  async function handleApprove() {
    if (!name.trim()) {
      setError('Please type your name to sign and approve.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await approveChangeOrderAction(approvalCode, name.trim());
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setResultMessage('Change order approved. Your contractor has been notified.');
    setMode('done');
    setLoading(false);
  }

  async function handleDecline() {
    setLoading(true);
    setError(null);
    const result = await declineChangeOrderAction(approvalCode, declineReason.trim() || undefined);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setResultMessage('Change order declined. Your contractor has been notified.');
    setMode('done');
    setLoading(false);
  }

  if (mode === 'done') {
    return (
      <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-sm font-medium text-emerald-800">{resultMessage}</p>
      </div>
    );
  }

  return (
    <section className="mt-7 rounded-xl border bg-muted/30 p-5">
      {error ? (
        <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {mode === 'pending' ? (
        <>
          <h2 className="text-base font-semibold">Approve this change order</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Type your name to sign — same as you would on paper. We'll email you a copy.
          </p>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="esig-name">Your full name</Label>
            <Input
              id="esig-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Type your full name to sign"
              disabled={loading}
            />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleApprove} disabled={loading} className="flex-1">
              {loading ? 'Approving…' : approveLabel}
            </Button>
            <Button
              variant="outline"
              onClick={() => setMode('decline')}
              disabled={loading}
              className="sm:w-auto"
            >
              Decline…
            </Button>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lock aria-hidden className="mt-0.5 size-3 shrink-0" />
            Your typed name is your e-signature. Encrypted · timestamped · logged to the project
            record.
          </p>
        </>
      ) : null}

      {mode === 'decline' ? (
        <>
          <h2 className="text-base font-semibold">Decline this change order</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Optionally let your contractor know why.
          </p>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="decline-reason">Reason (optional)</Label>
            <Textarea
              id="decline-reason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              placeholder="e.g. Going to hold off on this for now."
              disabled={loading}
            />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Declining…' : 'Confirm decline'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setMode('pending')}
              disabled={loading}
              className="sm:w-auto"
            >
              Back
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
