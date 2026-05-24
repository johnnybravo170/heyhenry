/**
 * First-run setup pass — the route an owner lands on right after /signup
 * (the only hard gate). Three skippable, resumable steps inside the (auth)
 * shell: vertical → business profile → meet Henry, then a hand-off to
 * /dashboard where the existing vertical-aware FirstRunHero takes over.
 *
 * SAFETY: this route is on the signup critical path, so it must never trap
 * a user. Reaching the dashboard is never gated on profile completeness —
 * every step has Skip + Back, and once `onboarding_completed_at` is set (or
 * the owner skips through the final step) this route redirects to /dashboard
 * with no loop. Existing tenants were backfilled to "complete" in the marker
 * migration, so they never see this.
 */

import { redirect } from 'next/navigation';
import { OnboardingFlow } from '@/components/features/onboarding/onboarding-flow';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { getBusinessProfile } from '@/lib/db/queries/profile';
import { createClient } from '@/lib/supabase/server';
import { isSelectableVertical } from '@/server/actions/onboarding';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const tenant = await getCurrentTenant();
  // Unauthenticated / orphaned → bounce to login. The (dashboard) layout has
  // its own requireTenant; here we just guard the entry.
  if (!tenant) redirect('/login');

  const supabase = await createClient();
  const { data: marker } = await supabase
    .from('tenants')
    .select('onboarding_step, onboarding_completed_at')
    .eq('id', tenant.id)
    .maybeSingle();

  // Already done (or a backfilled pre-existing tenant) → straight to the app.
  if (marker?.onboarding_completed_at) redirect('/dashboard');

  const profile = await getBusinessProfile(tenant.id);

  // Resume to the furthest-incomplete step. The marker is clamped to the
  // valid range in the client shell; we pass it through as the start step.
  const resumeStep = typeof marker?.onboarding_step === 'number' ? marker.onboarding_step : 0;

  // The vertical chosen at signup is hardcoded `renovation`; pre-select it
  // (or whatever the owner has since set) when it's a selectable option.
  const initialVertical = isSelectableVertical(tenant.vertical) ? tenant.vertical : 'renovation';

  return (
    <OnboardingFlow
      resumeStep={resumeStep}
      initialVertical={initialVertical}
      profile={{
        gstNumber: profile?.gstNumber ?? '',
        wcbNumber: profile?.wcbNumber ?? '',
        province: profile?.province ?? '',
        logoSignedUrl: profile?.logoSignedUrl ?? null,
        businessName: profile?.name ?? tenant.name,
        addressLine1: profile?.addressLine1 ?? '',
        addressLine2: profile?.addressLine2 ?? '',
        city: profile?.city ?? '',
        postalCode: profile?.postalCode ?? '',
        phone: profile?.phone ?? '',
        contactEmail: profile?.contactEmail ?? '',
        websiteUrl: profile?.websiteUrl ?? '',
        reviewUrl: profile?.reviewUrl ?? '',
      }}
    />
  );
}
