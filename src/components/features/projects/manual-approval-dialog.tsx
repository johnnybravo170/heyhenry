'use client';

/**
 * Shared manual-approval dialog for estimates and change orders.
 *
 * Operator opens it when a customer approved/declined off-platform
 * (text, phone, in-person, email). Captures method, customer name (for
 * approvals), notes, and optional proof attachments. Submits as
 * multipart FormData to the matching server action.
 *
 * Parent passes `resourceType` + `resourceId` + `mode`; this component
 * owns the form state + file list + submission.
 */

import { AlertTriangle, Paperclip, X } from 'lucide-react';
import { useState, useTransition } from 'react';
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
import {
  MANUAL_APPROVAL_METHODS,
  type ManualApprovalMethod,
  manualApprovalMethodLabels,
} from '@/lib/validators/manual-approval';
import {
  manuallyApproveChangeOrderAction,
  manuallyApproveEstimateAction,
  manuallyDeclineChangeOrderAction,
  manuallyDeclineEstimateAction,
} from '@/server/actions/manual-approval';

type ResourceType = 'estimate' | 'change_order';
type Mode = 'approve' | 'decline';

export function ManualApprovalDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  mode,
  bypassedSend = false,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: ResourceType;
  resourceId: string;
  mode: Mode;
  /**
   * True when the resource is still in draft (never sent to the customer).
   * Renders a warning banner so the operator knows no email/SMS will go out.
   * Use case: verbal approval, or backfilling an imported / historical project.
   */
  bypassedSend?: boolean;
  onSuccess?: () => void;
}) {
  const [method, setMethod] = useState<ManualApprovalMethod>('manual_text');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  // Each entry gets a stable id so the list doesn't re-key on reorder.
  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setMethod('manual_text');
    setCustomerName('');
    setNotes('');
    setReason('');
    setFiles([]);
    setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).map((file) => ({
      id: crypto.randomUUID(),
      file,
    }));
    setFiles((prev) => [...prev, ...picked].slice(0, 10));
    e.target.value = ''; // allow re-selecting the same file
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleSubmit() {
    setError(null);
    if (mode === 'approve' && !customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    const fd = new FormData();
    if (resourceType === 'estimate') fd.append('project_id', resourceId);
    else fd.append('change_order_id', resourceId);
    fd.append('method', method);
    if (mode === 'approve') fd.append('customer_name', customerName.trim());
    if (mode === 'decline' && reason.trim()) fd.append('reason', reason.trim());
    if (notes.trim()) fd.append('notes', notes.trim());
    for (const entry of files) fd.append('proof', entry.file);

    startTransition(async () => {
      const action =
        resourceType === 'estimate'
          ? mode === 'approve'
            ? manuallyApproveEstimateAction
            : manuallyDeclineEstimateAction
          : mode === 'approve'
            ? manuallyApproveChangeOrderAction
            : manuallyDeclineChangeOrderAction;
      const result = await action(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      onOpenChange(false);
      onSuccess?.();
    });
  }

  const resourceLabel = resourceType === 'estimate' ? 'estimate' : 'change order';
  const verb = mode === 'approve' ? 'approved' : 'declined';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Mark {resourceLabel} {verb}
          </DialogTitle>
          <DialogDescription>
            Record the customer&apos;s decision when they responded off-platform. Optional proof
            attachments (screenshot of text, email, etc.) help with your paper trail.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {bypassedSend ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <strong>The customer will not be notified.</strong> This {resourceLabel} hasn't been
                sent. Use this only for verbal approvals or when backfilling a project that was
                already approved off-platform.
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label>How did they respond?</Label>
            <div className="grid grid-cols-2 gap-2">
              {MANUAL_APPROVAL_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    method === m
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  {manualApprovalMethodLabels[m]}
                </button>
              ))}
            </div>
          </div>

          {mode === 'approve' ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ma-name">Customer name</Label>
              <Input
                id="ma-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. John Smith"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">Recorded as the person who approved.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ma-reason">Reason (optional)</Label>
              <Textarea
                id="ma-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What did they say?"
                rows={2}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="ma-notes">Notes (optional)</Label>
            <Textarea
              id="ma-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context for your records"
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Proof (optional)</Label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
              <Paperclip className="size-3.5" />
              <span>Attach screenshot, email, or PDF</span>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {files.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm">
                {files.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1"
                  >
                    <span className="truncate">{entry.file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(entry.id)}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${entry.file.name}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? 'Saving…' : mode === 'approve' ? 'Mark approved' : 'Mark declined'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
