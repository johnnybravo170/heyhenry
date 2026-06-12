'use client';

/**
 * Signup — email + password + business name. This is the ONLY path that
 * provisions a tenant row, per PHASE_1_PLAN Task 1.6. Magic link signup is
 * deferred to Phase 2.
 *
 * `useSearchParams` must live behind a Suspense boundary in Next.js 16 to
 * avoid a CSR bail-out during prerender — the rest of the form is static
 * enough to render statically.
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useTransition } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isBillingCycle, isPlan, PLAN_CATALOG } from '@/lib/billing/plans';
import { signupAction } from '@/server/actions/auth';

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [alreadyRegisteredEmail, setAlreadyRegisteredEmail] = useState<string | null>(null);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

  const referralCode = params?.get('ref') ?? undefined;
  const planParam = params?.get('plan');
  const billingParam = params?.get('billing');
  const promoParam = params?.get('promo')?.trim() || undefined;
  const selectedPlan = isPlan(planParam) ? planParam : null;
  const selectedBilling = isBillingCycle(billingParam) ? billingParam : null;

  useEffect(() => {
    if (params?.get('error') === 'no_tenant') {
      setError('Your account is missing a business. Create a new one here or contact support.');
    }
  }, [params]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setAlreadyRegisteredEmail(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const firstName = String(form.get('firstName') ?? '');
    const lastName = String(form.get('lastName') ?? '');
    const businessName = String(form.get('businessName') ?? '');
    const phone = String(form.get('phone') ?? '');

    startTransition(async () => {
      const result = await signupAction({
        email,
        password,
        firstName,
        lastName,
        businessName,
        phone,
        acceptedPolicies,
        referralCode,
        plan: selectedPlan ?? undefined,
        billing: selectedBilling ?? undefined,
        promo: promoParam,
      });
      if (result && 'error' in result) {
        if (result.code === 'EMAIL_ALREADY_REGISTERED') {
          setAlreadyRegisteredEmail(email);
          return;
        }
        setError(result.error);
        toast.error(result.error);
        return;
      }
      // signupAction redirects server-side (→ /onboarding, or /onboarding/plan
      // on the paid path). This push is only a fallback if that redirect ever
      // doesn't propagate; keep it pointed at the first-run setup pass.
      router.push('/onboarding');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Get started with HeyHenry</CardTitle>
        <CardDescription>Run your jobs from the truck. We handle the paperwork.</CardDescription>
        {/* Trial pill — always shown; rust-soft mono chip */}
        <div className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-brand/10 px-3 py-1 font-mono text-eyebrow font-bold uppercase tracking-[0.06em] text-brand">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
          14-day free trial · no card
        </div>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {referralCode ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-100 p-3 text-sm text-emerald-800">
              You were referred by a fellow contractor — your trial gets bumped to 14 days.
            </div>
          ) : null}
          {selectedPlan ? (
            <div className="rounded-md border border-blue-200 bg-blue-100 p-3 text-sm text-blue-800">
              You&apos;re starting on{' '}
              <span className="font-medium">{PLAN_CATALOG[selectedPlan].name}</span>
              {selectedBilling ? <span className="opacity-75"> · {selectedBilling}</span> : null}
              <span className="opacity-75"> · 14-day free trial, no card required</span>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
                disabled={pending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              name="businessName"
              type="text"
              autoComplete="organization"
              required
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 604 555 1234"
              required
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">We text a 6-digit code to verify it.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters with one letter and one number.
            </p>
          </div>
          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="acceptedPolicies"
              checked={acceptedPolicies}
              onCheckedChange={(v) => setAcceptedPolicies(v === true)}
              disabled={pending}
              className="mt-0.5"
              required
            />
            <Label
              htmlFor="acceptedPolicies"
              className="text-xs font-normal leading-snug text-muted-foreground"
            >
              I agree to the{' '}
              <Link
                href="/terms"
                target="_blank"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                target="_blank"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Privacy Policy
              </Link>
              .
            </Label>
          </div>
          {alreadyRegisteredEmail ? (
            <div
              className="space-y-3 rounded-md border border-amber-200 bg-amber-100 p-3 text-sm text-amber-800"
              role="alert"
            >
              <p className="font-medium">You already have a HeyHenry account.</p>
              <p>Sign in with your password, or get a one-click email link — no password needed.</p>
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href={`/login?email=${encodeURIComponent(alreadyRegisteredEmail)}`}
                  className="inline-flex items-center justify-center rounded-md border border-amber-400 bg-white/60 px-3 py-2 font-medium hover:bg-white/80 transition-colors"
                >
                  Sign in with password →
                </Link>
                <Link
                  href={`/magic-link?email=${encodeURIComponent(alreadyRegisteredEmail)}`}
                  className="inline-flex items-center justify-center rounded-md px-3 py-2 font-medium underline underline-offset-2 hover:text-amber-900"
                >
                  Email me a sign-in link instead
                </Link>
              </div>
            </div>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button
            variant="primary"
            type="submit"
            className="w-full"
            disabled={pending || !acceptedPolicies}
          >
            {pending ? 'Setting things up…' : 'Create my account'}
          </Button>
          <Link
            href="/login"
            className="w-full text-center text-sm text-muted-foreground hover:underline"
          >
            Already have an account? Sign in
          </Link>
          <p className="w-full text-center text-xs text-muted-foreground">
            Cancel any time. See{' '}
            <Link href="/refund-policy" className="underline underline-offset-2">
              refund policy
            </Link>
            .
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
