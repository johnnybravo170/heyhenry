import { redirect } from 'next/navigation';
import { AgreementSignStep } from '@/components/features/onboarding/agreement-sign-step';
import { getAgreement } from '@/lib/agreements/registry';
import { requireTenant } from '@/lib/auth/helpers';
import { hasAcceptedCurrentAgreement } from '@/lib/db/queries/agreements';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Founding member agreement — HeyHenry' };

type SearchParams = Promise<{ plan?: string; billing?: string; promo?: string }>;

/**
 * Founding-member agreement gate. Sits in front of the plan/checkout step:
 * a founding member must sign before they can subscribe. Non-founders fall
 * straight through (no agreement wired for them yet — base ToS is a future
 * type). Preserves the plan/billing/promo params so the FOUNDER link survives
 * the round-trip to checkout.
 */
export default async function OnboardingAgreementPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tenant } = await requireTenant();
  if (tenant.vertical === 'personal') redirect('/dashboard');

  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.plan) qs.set('plan', params.plan);
  if (params.billing) qs.set('billing', params.billing);
  if (params.promo) qs.set('promo', params.promo);
  const nextHref = `/onboarding/plan${qs.toString() ? `?${qs.toString()}` : ''}`;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('tenants')
    .select('stripe_subscription_id, founding_member')
    .eq('id', tenant.id)
    .single();

  if (row?.stripe_subscription_id) redirect('/dashboard');
  if (!row?.founding_member) redirect(nextHref);
  if (await hasAcceptedCurrentAgreement(tenant.id, 'founding_member')) redirect(nextHref);

  const def = getAgreement('founding_member');
  // The (auth) shell caps content at max-w-md, which is too narrow for a
  // contract. Break out of that cap (full-bleed) and re-center the agreement
  // at a comfortable reading width — without widening login/signup.
  return (
    <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 px-4">
      <div className="mx-auto w-full max-w-2xl">
        <AgreementSignStep
          type={def.type}
          title={def.title}
          intro={def.intro}
          bodyMarkdown={def.bodyMarkdown}
          nextHref={nextHref}
        />
      </div>
    </div>
  );
}
