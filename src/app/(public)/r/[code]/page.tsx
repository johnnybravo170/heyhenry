import { ArrowRight, Check, Link2Off, Lock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { findReferralCodeByCode } from '@/lib/db/queries/referrals';

/**
 * Public referral landing — a stranger's first impression of HeyHenry,
 * arriving from a peer's recommendation.
 *
 * BOUNDARY (public, no-login): this page exposes ONLY `tenant_name`. It does
 * NOT call getCurrentTenant() or any authed helper — `findReferralCodeByCode`
 * uses the admin client behind anon-safe RLS and returns just
 * { id, code, tenant_id, tenant_name }. Never surface the referrer's email,
 * stats, internal IDs, or anything beyond the business name.
 *
 * Brand posture: light HeyHenry wordmark on the Paper field — NOT the
 * operator's branding, NOT the dashboard shell. A bad/expired code shows a
 * graceful "this link isn't active" state, never a silent anonymous fallback.
 */
export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.heyhenry.io';

type Props = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const refCode = await findReferralCodeByCode(code);

  if (!refCode) {
    return { title: 'Join HeyHenry' };
  }

  return {
    title: `${refCode.tenant_name} uses HeyHenry — Join today`,
    description: `${refCode.tenant_name} uses HeyHenry to run their contracting business. Start your free 14-day trial.`,
  };
}

function Wordmark() {
  return (
    <header className="flex h-16 items-center border-b px-6 sm:px-8">
      <span className="inline-flex items-center gap-2 text-foreground">
        <span className="grid size-7 place-items-center rounded-lg bg-foreground text-sm font-bold tracking-tight text-background">
          H
        </span>
        <span className="text-base font-bold tracking-tight">HeyHenry</span>
      </span>
    </header>
  );
}

const VALUE_BULLETS = [
  'Instant quote builder with your real pricing.',
  'Scheduling, site photos, and crew logs from the truck.',
  'One-click invoicing — clients pay online by card or e-Transfer.',
  'Henry — the AI assistant that knows your business.',
];

export default async function ReferralLandingPage({ params }: Props) {
  const { code } = await params;
  const refCode = await findReferralCodeByCode(code);

  // Graceful invalid / expired code — acknowledge the dead link, don't pretend.
  if (!refCode) {
    return (
      <div className="flex min-h-[80vh] flex-col">
        <Wordmark />
        <main className="flex flex-1 items-start justify-center px-4 py-20">
          <div className="flex w-full max-w-lg flex-col items-center text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Link2Off className="size-6" aria-hidden="true" />
            </span>
            <p className="mt-4 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Referral link · not active
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">
              This referral link isn&apos;t active anymore.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              The contractor who shared this link may have changed it, or the link expired. No
              worries — you can still try HeyHenry free for 14 days.
            </p>
            <div className="mt-8 flex flex-col items-center gap-2.5">
              <Link
                href={`${APP_URL}/signup`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-brand px-7 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
              >
                Start your free trial
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3 text-muted-foreground/60" aria-hidden="true" />
                No credit card required · set up in under 5 minutes.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const signupUrl = `${APP_URL}/signup?ref=${code}`;

  return (
    <div className="flex min-h-[80vh] flex-col">
      <Wordmark />
      <main className="flex flex-1 items-start justify-center px-4 py-20 sm:py-24">
        <div className="flex w-full max-w-xl flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-muted/50 py-1.5 pl-2.5 pr-3.5 text-sm font-medium text-foreground">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
            <span className="font-bold">{refCode.tenant_name}</span> uses HeyHenry
          </span>

          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-balance text-foreground sm:text-[2.75rem]">
            Run your contracting business smarter.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">{refCode.tenant_name}</span> invited you
            to try HeyHenry. Manage quotes, jobs, invoices, and clients in one place — start your
            free <span className="font-semibold text-foreground">14-day extended trial</span>.
          </p>

          <ul className="mt-7 flex w-full max-w-md flex-col gap-3 text-left">
            {VALUE_BULLETS.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-3 text-sm leading-snug text-foreground"
              >
                <span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full bg-muted/60 text-foreground">
                  <Check className="size-3" aria-hidden="true" />
                </span>
                {bullet}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col items-center gap-2.5">
            <Link
              href={signupUrl}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-brand px-7 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
            >
              Start your free 14-day trial
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3 text-muted-foreground/60" aria-hidden="true" />
              No credit card required · set up in under 5 minutes.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
