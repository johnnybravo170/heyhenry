import { redirect } from 'next/navigation';
import { PlanPicker } from '@/components/features/onboarding/plan-picker';
import { requireTenant } from '@/lib/auth/helpers';
import { isBillingCycle, isPlan } from '@/lib/billing/plans';
import { hasAcceptedCurrentAgreement } from '@/lib/db/queries/agreements';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePromoEffects, startCheckoutAction } from '@/server/actions/billing';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pick your plan — HeyHenry' };

type SearchParams = Promise<{
  plan?: string;
  billing?: string;
  canceled?: string;
  promo?: string;
}>;

export default async function OnboardingPlanPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenant } = await requireTenant();

  // Personal workspaces don't have a paid plan surface — bounce out.
  if (tenant.vertical === 'personal') redirect('/dashboard');

  // Already subscribed → straight through to dashboard.
  const admin = createAdminClient();
  const { data: row } = await admin
    .from('tenants')
    .select('stripe_subscription_id, subscription_status, founding_member')
    .eq('id', tenant.id)
    .single();
  if (row?.stripe_subscription_id) redirect('/dashboard');

  const params = await searchParams;
  const initialPlan = isPlan(params.plan) ? params.plan : null;
  const initialCycle = isBillingCycle(params.billing) ? params.billing : 'monthly';
  const initialPromo = typeof params.promo === 'string' ? params.promo.trim() || null : null;

  // Founding members sign the founding-member agreement before checkout.
  // Preserve plan/billing/promo so the FOUNDER link survives the round-trip.
  if (row?.founding_member && !(await hasAcceptedCurrentAgreement(tenant.id, 'founding_member'))) {
    const qs = new URLSearchParams();
    if (params.plan) qs.set('plan', params.plan);
    if (params.billing) qs.set('billing', params.billing);
    if (params.promo) qs.set('promo', params.promo);
    redirect(`/onboarding/agreement${qs.toString() ? `?${qs.toString()}` : ''}`);
  }

  // Founding members have exactly one plan (Growth) at the locked $199 rate,
  // and they've just signed — so the single-option picker is a dead click.
  // Send them straight into checkout. `canceled` (bounced back from Stripe)
  // falls through to the picker so they aren't trapped in a redirect loop.
  const canceled = params.canceled === '1' || params.canceled === 'true';
  if (row?.founding_member && !canceled) {
    const res = await startCheckoutAction({
      plan: 'growth',
      billing: 'monthly',
      promo: initialPromo ?? 'FOUNDER',
    });
    // Reached only if checkout couldn't start (redirect throws on success).
    // Fall through to render the picker so the founder is never stuck.
    if (res && 'error' in res) {
      console.error('[onboarding/plan] founding auto-checkout failed:', res.error);
    }
  }

  // Resolve promo server-side so we can show the right copy ("card charged
  // today" vs "14-day free trial") before the user clicks Continue. The
  // skip-trial flag is encoded in Stripe metadata on the promo code.
  const promoEffects = initialPromo
    ? await resolvePromoEffects(initialPromo)
    : { promotionCodeId: null, skipTrial: false };

  return (
    <PlanPicker
      initialPlan={initialPlan}
      initialCycle={initialCycle}
      initialPromo={promoEffects.promotionCodeId ? initialPromo : null}
      skipTrial={promoEffects.skipTrial}
    />
  );
}
