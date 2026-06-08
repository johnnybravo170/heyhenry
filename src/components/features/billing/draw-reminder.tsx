'use client';

/**
 * Per-overdue-invoice payment-reminder control — the AR chase at the get-paid
 * leverage point (not a chat box).
 *
 * "Send reminder" re-emails the already-sent invoice with its payment link
 * (`resendInvoiceAction`). It's a **deferred** send with **Undo**: clicking
 * arms a short timer and shows a Henry-labelled toast; the email only goes out
 * if the operator doesn't cancel. After it fires, the row shows a quiet
 * "Reminder sent" trace so the same nudge isn't fired twice in a sitting.
 *
 * Scope note: the scheduled, CASL-policy AR sequence engine (`lib/ar/*`) is
 * quote-focused today and does not cover invoices — wiring invoices into that
 * nightly engine is a separate, larger effort. This is the manual, immediate
 * reminder; the briefed "Henry sent a reminder Nd ago" history needs a tracked
 * per-invoice reminder log that doesn't exist yet (deferred).
 */

import { Check, Loader2, Send } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { resendInvoiceAction } from '@/server/actions/invoices';

/** Grace window (ms) before the reminder actually sends — the Undo window. */
const UNDO_MS = 5000;

export function DrawReminder({
  invoiceId,
  customerName,
}: {
  invoiceId: string;
  customerName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const who = customerName ?? 'the customer';

  function fire() {
    startTransition(async () => {
      const res = await resendInvoiceAction({ invoiceId });
      if (res.ok) {
        setSent(true);
        toast.success(`Reminder sent to ${who}.`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleClick() {
    if (timerRef.current) return; // already armed
    const id = setTimeout(() => {
      timerRef.current = null;
      fire();
    }, UNDO_MS);
    timerRef.current = id;

    toast(`Henry will email ${who} a payment reminder.`, {
      duration: UNDO_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        },
      },
    });
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="size-3" aria-hidden />
        Reminder sent
      </span>
    );
  }

  return (
    <Button type="button" variant="outline" size="xs" onClick={handleClick} disabled={pending}>
      {pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <Send className="size-3" aria-hidden />
      )}
      Send reminder
    </Button>
  );
}
