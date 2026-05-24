import { redirect } from 'next/navigation';
import { requireTenant } from '@/lib/auth/helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubscriptionStatusPoller } from './poller';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Subscription started — HeyHenry' };

/**
 * Stripe Checkout success landing. The Stripe webhook writes
 * `tenants.stripe_subscription_id` — by the time the customer hits this
 * page the webhook usually has already fired. If so, hand off to the
 * first-run setup pass immediately. Otherwise hand off to a client poller
 * so the customer doesn't have to manually refresh.
 *
 * Routes to /onboarding (not straight to /dashboard) so the paid path also
 * gets the setup pass; /onboarding self-redirects to /dashboard once the
 * tenant is already onboarded, so this never loops.
 */
export default async function CheckoutSuccessPage() {
  const { tenant } = await requireTenant();

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('tenants')
    .select('stripe_subscription_id')
    .eq('id', tenant.id)
    .single();

  if (row?.stripe_subscription_id) redirect('/onboarding');

  return <SubscriptionStatusPoller />;
}
