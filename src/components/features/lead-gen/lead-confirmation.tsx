'use client';

/**
 * Step 3 of the public lead-gen flow: confirmation screen.
 *
 * Shown after the homeowner successfully submits their contact info.
 */

import { CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/pricing/calculator';

type LeadConfirmationProps = {
  businessName: string;
  totalCents: number;
};

export function LeadConfirmation({ businessName, totalCents }: LeadConfirmationProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <CheckCircle2 className="size-12 text-green-600" />
      <h2 className="text-2xl font-semibold">Thanks!</h2>
      <p className="text-muted-foreground">{businessName} will be in touch shortly.</p>
      <div className="rounded-xl border bg-card px-6 py-4">
        <p className="text-sm text-muted-foreground">Your estimated total</p>
        <p className="text-3xl font-bold tabular-nums">{formatCurrency(totalCents)}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Your quote has been saved. You will receive a follow-up with the full details.
      </p>
    </div>
  );
}
