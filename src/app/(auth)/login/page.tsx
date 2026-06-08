'use client';

/**
 * Login page — email + password or "use magic link instead".
 *
 * We call the server action directly from a `useTransition` handler so we
 * can show an inline error instead of relying on `useActionState`'s
 * form-data contract. Either approach is fine in Next.js 16; this one
 * keeps the schema-validated call site consistent with signup.
 */

import { Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useTransition } from 'react';
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
import { loginAction } from '@/server/actions/auth';

export default function LoginPage() {
  // useSearchParams forces a Suspense boundary at build time (Next 16
  // bails on prerender otherwise). Wrap the form so the page itself
  // stays cheap to prerender.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const recoveryUsed = searchParams?.get('recovery') === '1';
  const prefilledEmail = searchParams?.get('email')?.trim() || '';

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    const next = searchParams?.get('next') ?? undefined;
    const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
    startTransition(async () => {
      const result = await loginAction({ email, password, next });
      if (result && 'error' in result) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      // Server action redirects on success; this is a fallback.
      router.push(safeNext);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Sign in to HeyHenry</CardTitle>
        <CardDescription>Welcome back.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {recoveryUsed ? (
            <div className="rounded-md border border-amber-200 bg-amber-100 p-3 text-sm text-amber-800">
              Two-factor authentication was removed from your account. Sign in, then set it up again
              from Settings &rsaquo; Security.
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={prefilledEmail}
              required
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>

          {/* — or — divider */}
          <div className="flex w-full items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-eyebrow uppercase tracking-[0.06em] text-muted-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* Co-equal magic-link path */}
          <Button asChild variant="outline" className="w-full" disabled={pending}>
            <Link href="/magic-link">
              <Mail className="size-4" />
              Email me a sign-in link
            </Link>
          </Button>

          <div className="flex w-full justify-between text-sm">
            <Link href="/magic-link" className="text-muted-foreground hover:underline">
              Forgot your password?
            </Link>
            <Link href="/signup" className="text-muted-foreground hover:underline">
              No account? <strong>Sign up</strong>
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
