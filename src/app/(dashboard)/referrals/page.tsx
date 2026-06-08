/**
 * Referrals — "Refer & Earn" dashboard page.
 *
 * Server component that fetches the tenant's referral code, stats, and
 * history. Client interactivity lives in the child components (copy link,
 * send invite forms).
 */

import { Info } from 'lucide-react';
import { AffiliateOfferCard } from '@/components/features/referrals/affiliate-offer-card';
import { ReferralHistory } from '@/components/features/referrals/referral-history';
import { ReferralStats } from '@/components/features/referrals/referral-stats';
import { ShareHeroCard } from '@/components/features/referrals/share-hero-card';
import { requireTenant } from '@/lib/auth/helpers';
import {
  getAffiliateTierAction,
  getReferralHistoryAction,
  getReferralLinkAction,
  getReferralStatsAction,
} from '@/server/actions/referrals';

export const metadata = {
  title: 'Refer & Earn — HeyHenry',
};

export default async function ReferralsPage() {
  const { tenant } = await requireTenant();
  const [linkResult, statsResult, historyResult, tierResult] = await Promise.all([
    getReferralLinkAction(),
    getReferralStatsAction(),
    getReferralHistoryAction(),
    getAffiliateTierAction(),
  ]);

  const link = linkResult.ok ? linkResult.data : { code: '', url: '' };
  const stats = statsResult.ok ? statsResult.data : { total: 0, signed_up: 0, converted: 0 };
  const history = historyResult.ok ? historyResult.data : [];
  const tier = tierResult.ok ? tierResult.data : 'tier_3';

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Personal / Refer &amp; Earn
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Refer &amp; Earn</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          {tier === 'tier_3'
            ? "Know another contractor who'd get something out of HeyHenry? Send them your link. If they stick around 90 days, we'll send you $300 CAD as a thank-you."
            : 'Know another contractor who would get something out of HeyHenry? Send them your link. Your commission terms are covered by your partner agreement.'}
        </p>
      </header>

      {/* Share-first cockpit — the one job */}
      <ShareHeroCard url={link.url} code={link.code} />

      {/* Offer — context, demoted below the hero */}
      <AffiliateOfferCard tier={tier} />

      {/* Honest stats — two wired, one "coming" */}
      <ReferralStats stats={stats} />

      {/* History */}
      <ReferralHistory referrals={history} timezone={tenant.timezone} />

      {/* Honest graduate note about the unbuilt payout pipeline */}
      <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/20 p-3.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p>
          <span className="font-semibold text-foreground">About “Conversions &amp; rewards.”</span>{' '}
          The 90-day payout pipeline — when a signup flips to converted, and how a $300 CAD reward
          credits or pays out — is a separate workstream. We&apos;re not faking those states here.
          When it ships, this page gets a real balance and Henry will explain each step.
        </p>
      </div>
    </div>
  );
}
