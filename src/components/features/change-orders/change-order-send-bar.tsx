'use client';

/**
 * Send-preview controls for a draft change order — the CO analogue of the
 * estimate `EstimatePreviewSendBar`. Opens a confirm dialog that shows:
 *   - recipient(s) (customer email + phone on file)
 *   - a copyable `/approve/{code}` link (so the GC can text it themselves)
 *   - the "email + SMS both go out" channel note
 *
 * The rendered customer document the homeowner receives is the page this bar
 * sits on (the CO detail), so this is the send confirmation, not a second
 * preview surface. Mirrors the estimate pattern: confirm → send.
 */

import { Check, Copy, Loader2, MessageSquare, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { sendChangeOrderAction } from '@/server/actions/change-orders';

export function ChangeOrderSendBar({
  changeOrderId,
  approvalCode,
  customerName,
  customerEmail,
  customerPhone,
  totalImpactLabel,
}: {
  changeOrderId: string;
  approvalCode: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  /** Pre-formatted "+$3,341.63" headline so the dialog confirms the figure. */
  totalImpactLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const firstName = customerName.split(/\s+/)[0] || 'customer';
  const approveLink =
    approvalCode && typeof window !== 'undefined'
      ? `${window.location.origin}/approve/${approvalCode}`
      : approvalCode
        ? `/approve/${approvalCode}`
        : null;

  function handleSend() {
    startTransition(async () => {
      const res = await sendChangeOrderAction(changeOrderId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Change order sent to ${firstName}`);
      setOpen(false);
      router.refresh();
    });
  }

  async function handleCopy() {
    if (!approveLink) return;
    try {
      await navigator.clipboard.writeText(approveLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy link');
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button>
          <Send className="size-3.5" />
          Send for approval
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send change order?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Sending to <span className="font-medium text-foreground">{customerName}</span> —{' '}
                total impact <span className="font-medium text-foreground">{totalImpactLabel}</span>
                .
              </p>

              {/* Recipients on file */}
              <div className="space-y-1.5">
                <Label>Recipients</Label>
                <div className="space-y-1 rounded-md border bg-muted/30 p-2 text-sm">
                  {customerEmail ? (
                    <div className="flex items-center gap-2">
                      <Send className="size-3 text-muted-foreground" />
                      <span>{customerEmail}</span>
                    </div>
                  ) : null}
                  {customerPhone ? (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="size-3 text-muted-foreground" />
                      <span>{customerPhone}</span>
                    </div>
                  ) : null}
                  {!customerEmail && !customerPhone ? (
                    <span className="text-amber-700">
                      No email or phone on file — add one on the customer first.
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Channel note */}
              <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-800">
                <MessageSquare className="size-3.5 shrink-0" />
                <span>
                  Email <strong>and</strong> SMS both go out — the urgency lives in the text.
                </span>
              </div>

              {/* Copyable approval link */}
              {approveLink ? (
                <div className="space-y-1.5">
                  <Label>Approval link</Label>
                  <div className="flex items-stretch overflow-hidden rounded-md border bg-muted/30">
                    <span className="flex-1 truncate px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                      {approveLink}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 border-l bg-background px-3 font-mono text-[0.65rem] font-bold uppercase tracking-wide hover:bg-muted"
                    >
                      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Text it to {firstName} yourself if you'd rather.
                  </p>
                </div>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button onClick={handleSend} disabled={pending || (!customerEmail && !customerPhone)}>
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Send now
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
