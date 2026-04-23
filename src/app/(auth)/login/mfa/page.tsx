'use client';

/**
 * MFA challenge at login. Shown after the password step when the user has
 * a verified TOTP factor. Submitting a valid 6-digit code upgrades the
 * session to aal2 and redirects to /dashboard.
 *
 * "Use a recovery code" link → /login/mfa/recover.
 */

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
import { challengeLoginMfaAction } from '@/server/actions/mfa-login';

export default function LoginMfaPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await challengeLoginMfaAction({ code });
      if (result && 'error' in result) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      router.push('/dashboard');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Two-factor authentication</CardTitle>
        <CardDescription>Enter the 6-digit code from your authenticator app.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={pending}
              placeholder="123456"
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button type="submit" className="w-full" disabled={pending || code.length !== 6}>
            {pending ? 'Verifying…' : 'Verify'}
          </Button>
          <div className="flex w-full justify-between text-sm">
            <Link href="/login/mfa/recover" className="text-muted-foreground hover:underline">
              Use a recovery code
            </Link>
            <Link href="/logout" className="text-muted-foreground hover:underline">
              Cancel
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
