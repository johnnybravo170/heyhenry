import { ShieldCheck } from 'lucide-react';
import { MfaCard } from '@/components/features/settings/mfa-card';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAuth } from '@/lib/auth/helpers';
import { getMfaStatus } from '@/lib/auth/mfa';

export default async function SecuritySettingsPage() {
  await requireAuth();
  const status = await getMfaStatus();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground">
          Two-factor authentication and account protection.
        </p>
      </div>

      <MfaCard
        enrolled={status?.enrolled ?? false}
        recoveryCodesRemaining={status?.recoveryCodesRemaining ?? 0}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-muted-foreground" />
            <div>
              <CardTitle>Lost your device?</CardTitle>
              <CardDescription>
                Use a recovery code to sign in, then set up 2FA again on your new device. If
                you&apos;ve run out of recovery codes, email{' '}
                <a href="mailto:support@heyhenry.io" className="underline">
                  support@heyhenry.io
                </a>{' '}
                and we&apos;ll verify your identity and reset it.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
