import { Clock, Send, UserCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';

type StatsData = {
  total: number;
  signed_up: number;
  converted: number;
};

/**
 * Honest stats. Two wired numbers (Sent, Signups) + one quiet "coming" tile
 * for Conversions & rewards.
 *
 * We deliberately do NOT render a Conversions count or a "$0 rewards" balance:
 * nothing in the codebase flips a referral to `converted` or advances
 * `reward_status`, so both would always read 0. Showing a fake $0 balance
 * implies a payout pipeline that doesn't exist. When it ships, this tile
 * becomes a real number — see the share-hero/page graduate note.
 */
export function ReferralStats({ stats }: { stats: StatsData }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Card className="flex flex-col gap-1.5 p-4">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Send className="size-3 text-muted-foreground/70" aria-hidden="true" />
          Referrals sent
        </p>
        <p className="text-base font-bold tabular-nums leading-tight tracking-tight text-foreground">
          {stats.total}
        </p>
        <p className="text-xs leading-snug text-muted-foreground">
          Across email, text, and shared links.
        </p>
      </Card>

      <Card className="flex flex-col gap-1.5 p-4">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <UserCheck className="size-3 text-muted-foreground/70" aria-hidden="true" />
          Signups
        </p>
        <p className="text-base font-bold tabular-nums leading-tight tracking-tight text-foreground">
          {stats.signed_up}
        </p>
        <p className="text-xs leading-snug text-muted-foreground">
          Contractors who started a trial from your link.
        </p>
      </Card>

      <Card className="col-span-2 flex flex-col gap-1.5 border-dashed bg-muted/20 p-4 sm:col-span-1">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="size-3 text-muted-foreground/70" aria-hidden="true" />
          Conversions &amp; rewards
        </p>
        <span className="inline-flex w-fit items-center rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Coming
        </span>
        <p className="text-xs leading-snug text-muted-foreground">
          We&apos;re still building the payout pipeline. We won&apos;t show a fake balance — when it
          ships, you&apos;ll see real numbers.
        </p>
      </Card>
    </div>
  );
}
