import { Check, Gift, Handshake } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { AffiliateTier } from '@/server/actions/referrals';

/**
 * The referral offer, demoted below the share hero. Calm neutral card on the
 * Paper field — NOT a green "money" card (color is reserved for action; rust
 * is the one accent). The $300 figure rides a small rust chip; everything else
 * is ink. Fine print kept (load-bearing for program integrity) but quiet.
 */
export function AffiliateOfferCard({ tier }: { tier: AffiliateTier }) {
  if (tier === 'tier_1' || tier === 'tier_2') {
    return (
      <Card className="overflow-hidden p-0">
        <div className="flex items-start gap-3 border-b p-4">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
            <Handshake className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              The offer
            </p>
            <h3 className="text-base font-bold leading-tight tracking-tight text-foreground">
              Custom partner agreement
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              You&apos;re on a partner program with terms outside the standard offer.
            </p>
          </div>
        </div>
        <div className="p-4 text-sm text-muted-foreground">
          Commission terms are in your signed agreement. Reach out to Jonathan with any questions.
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start gap-3 border-b p-4">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
          <Gift className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            The offer
          </p>
          <h3 className="text-base font-bold leading-tight tracking-tight text-foreground">
            $300 CAD for every contractor who signs up and sticks
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Flat thank-you, no cap. Paid once they&apos;ve been a paying customer for 90 days.
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-md border border-brand/20 bg-brand/5 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-brand">
          $300 · CAD
        </span>
      </div>
      <div className="p-4">
        <ul className="flex flex-col gap-2 text-sm text-foreground">
          {[
            'Flat $300 CAD per converted paying customer — no tiers, no climb.',
            'Paid once the referred business has been paid and current for 90 days.',
            'No cap. Refer as many as you like, whenever it feels right.',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5 leading-snug">
              <Check className="mt-0.5 size-3.5 shrink-0 text-foreground" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-dashed pt-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Fine print:</span> the referred business
          must be operationally distinct from yours (different owner, address, and payment method).
          Refunds or chargebacks inside the 90-day window claw back the bounty.
        </p>
      </div>
    </Card>
  );
}
