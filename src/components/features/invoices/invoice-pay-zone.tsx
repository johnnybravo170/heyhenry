'use client';

/**
 * The dual-pay zone on the customer invoice pay surface — Stripe card and
 * Interac e-Transfer at TRUE parity. Client component because Interac is a
 * structured, one-tap-copyable block (recipient · amount · memo), not free
 * text, and because the mobile sticky Pay bar needs to scroll the customer
 * to the right option.
 *
 * Customer-facing: price-only, GC brand, no operator chrome, no Henry. The
 * structured e-Transfer fields come from the server (parsed recipient email
 * + memo + the invoice total) — Canadians pay by e-Transfer constantly, so
 * this gets equal billing with the card option.
 */

import { Banknote, Check, Copy, CreditCard, Lock } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export type InteracDetails = {
  /** Recipient e-Transfer email (parsed from the GC's payment instructions). */
  recipientEmail: string | null;
  /** Pre-formatted amount string, e.g. "$32,348.46 CAD". */
  amountLabel: string;
  /** Suggested transfer message / memo, e.g. "INV-2406-031". */
  memo: string;
  /** Optional free-text payment instructions from the GC, shown as a footnote. */
  instructions: string | null;
};

function CopyRow({
  label,
  value,
  mono,
  amount,
}: {
  label: string;
  value: string;
  mono?: boolean;
  amount?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy — please copy it manually.');
    }
  }, [label, value]);

  return (
    <div className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 border-b px-3 py-2.5 text-sm last:border-0">
      <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={
          amount
            ? 'truncate font-semibold tabular-nums text-foreground'
            : mono
              ? 'truncate font-mono text-xs text-foreground'
              : 'truncate font-medium text-foreground'
        }
      >
        {value}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        {copied ? <Check className="text-emerald-600" /> : <Copy />}
      </Button>
    </div>
  );
}

export function InvoicePayZone({
  paymentUrl,
  payButtonLabel,
  interac,
}: {
  /** Stripe checkout link, pre-created at send time. Null → card unavailable. */
  paymentUrl: string | null;
  /** e.g. "Pay $32,348.46 with card". */
  payButtonLabel: string;
  interac: InteracDetails;
}) {
  const copyAll = useCallback(async () => {
    const parts = [
      interac.recipientEmail ? `Send to: ${interac.recipientEmail}` : null,
      `Amount: ${interac.amountLabel}`,
      `Message: ${interac.memo}`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(parts.join('\n'));
      toast.success('e-Transfer details copied');
    } catch {
      toast.error('Could not copy — please copy each field manually.');
    }
  }, [interac]);

  return (
    <section className="mt-7" id="pay">
      <h3 className="text-sm font-semibold">How would you like to pay?</h3>
      <p className="mb-3.5 text-sm text-muted-foreground">
        Pick one — you&rsquo;ll get a confirmation either way.
      </p>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* Card via Stripe */}
        <div className="flex flex-col rounded-xl border p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-background">
              <CreditCard className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">Pay by credit card</p>
              <p className="text-xs text-muted-foreground">Visa · Mastercard · Amex</p>
            </div>
          </div>
          <div className="flex-1 text-sm text-muted-foreground">
            Opens a secure checkout. We never see your card details.
            <ul className="mt-2.5 space-y-1.5">
              {['Marked paid instantly', 'Emailed receipt'].map((t) => (
                <li key={t} className="flex items-baseline gap-2">
                  <Check className="h-3 w-3 shrink-0 translate-y-0.5 text-emerald-600" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            {paymentUrl ? (
              <Button asChild size="lg" className="h-11 w-full text-sm font-semibold">
                <a href={paymentUrl}>{payButtonLabel}</a>
              </Button>
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-2.5 text-center text-xs text-muted-foreground">
                Card payment isn&rsquo;t set up for this invoice — use e-Transfer.
              </p>
            )}
          </div>
          {paymentUrl ? (
            <p className="mt-3 flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              <Lock className="h-2.5 w-2.5 text-emerald-600" />
              Secured by Stripe
            </p>
          ) : null}
        </div>

        {/* Interac e-Transfer — structured, copyable, parity */}
        <div className="flex flex-col rounded-xl border p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#B61D24] text-sm font-extrabold tracking-tighter text-white">
              i⇊
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">Pay by Interac e-Transfer</p>
              <p className="text-xs text-muted-foreground">From any Canadian bank app · no fee</p>
            </div>
          </div>

          <section
            className="overflow-hidden rounded-lg border bg-muted/30"
            aria-label="Interac e-Transfer details"
          >
            {interac.recipientEmail ? (
              <CopyRow label="Send to" value={interac.recipientEmail} mono />
            ) : null}
            <CopyRow label="Amount" value={interac.amountLabel} amount />
            <CopyRow label="Message" value={interac.memo} mono />
          </section>

          <p className="mt-3 flex-1 text-xs leading-relaxed text-muted-foreground">
            {interac.instructions?.trim() ? (
              <span className="whitespace-pre-wrap">{interac.instructions.trim()}</span>
            ) : (
              <>
                <span className="font-medium text-foreground/80">
                  Most Canadian bank apps auto-deposit
                </span>{' '}
                — we&rsquo;ll mark this paid and email you a receipt once it lands.
              </>
            )}
          </p>

          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={copyAll}
              className="h-11 w-full border-[#B61D24]/40 text-sm font-semibold text-[#B61D24] hover:bg-[#B61D24]/5 hover:text-[#B61D24]"
            >
              <Banknote className="h-4 w-4" />
              Copy all e-Transfer details
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sticky pay bar — thumb-reachable, 44px+, no scroll-past.
          Only when a card link exists; e-Transfer customers use the block. */}
      {paymentUrl ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] backdrop-blur sm:hidden">
          <Button asChild className="h-12 w-full text-base font-semibold">
            <a href={paymentUrl}>{payButtonLabel}</a>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
