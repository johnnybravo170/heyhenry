import { Suspense } from 'react';
import { StripeConnectCard } from '@/components/features/settings/stripe-connect-card';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';

async function StripeSection() {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('tenants')
    .select('stripe_account_id, stripe_onboarded_at')
    .eq('id', tenant.id)
    .single();

  return (
    <StripeConnectCard
      stripeAccountId={(data?.stripe_account_id as string) ?? null}
      stripeOnboardedAt={(data?.stripe_onboarded_at as string) ?? null}
    />
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, payments, and preferences.
        </p>
      </div>

      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl border bg-card" />}>
        <StripeSection />
      </Suspense>
    </div>
  );
}
