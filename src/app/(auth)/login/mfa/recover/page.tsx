'use client';

/**
 * Recovery-code fallback for a lost authenticator.
 *
 * Using a recovery code REMOVES the user's TOTP factor entirely and wipes
 * all their other recovery codes. Supabase logs all sessions out when the
 * verified factor is deleted, so on success we redirect to /login with a
 * recovery=1 flag. The user signs in fresh and is nudged to re-enroll on
 * /settings/security.
 */

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { redeemRecoveryCodeAction } from '@/server/actions/mfa-login';

export default function LoginMfaRecoverPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await redeemRecoveryCodeAction({ code });
      if (result && 'error' in result) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      router.push('/login?recovery=1');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Use a recovery code</CardTitle>
        <CardDescription>
          Enter one of the recovery codes you saved when you set up 2FA.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
            <p>
              Using a recovery code will remove 2FA from your account. You&apos;ll be signed out and
              asked to set up 2FA again on your new device.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recovery-code">Recovery code</Label>
            <Input
              id="recovery-code"
              autoComplete="one-time-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={pending}
              placeholder="abcd-ef12-3456"
              className="font-mono"
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button type="submit" className="w-full" disabled={pending || !code.trim()}>
            {pending ? 'Verifying…' : 'Use code &amp; remove 2FA'}
          </Button>
          <div className="flex w-full justify-between text-sm">
            <Link href="/login/mfa" className="text-muted-foreground hover:underline">
              Back to 6-digit code
            </Link>
            <a href="mailto:support@heyhenry.io" className="text-muted-foreground hover:underline">
              No codes left? Email support
            </a>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
