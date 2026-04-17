import type { Metadata } from 'next';
import Link from 'next/link';
import { findReferralCodeByCode } from '@/lib/db/queries/referrals';

export const dynamic = 'force-dynamic';

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

export default async function ReferralLandingPage({ params }: Props) {
  const { code } = await params;
  const refCode = await findReferralCodeByCode(code);

  const signupUrl = refCode
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.heyhenry.io'}/signup?ref=${code}`
    : `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.heyhenry.io'}/signup`;

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-lg text-center">
        {refCode ? (
          <>
            <div className="mb-6 inline-flex items-center rounded-full border bg-green-50 px-4 py-1.5 text-sm text-green-700">
              {refCode.tenant_name} uses HeyHenry
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Run your contracting business smarter
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {refCode.tenant_name} invited you to try HeyHenry. Manage quotes, jobs, invoices, and
              customers in one place. Start your free 14-day extended trial.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Run your contracting business smarter
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Manage quotes, jobs, invoices, and customers in one place. Built for contractors.
            </p>
          </>
        )}

        <ul className="mx-auto mt-8 max-w-sm space-y-3 text-left text-sm">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-green-600">&#10003;</span>
            <span>Instant quote builder with your real pricing</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-green-600">&#10003;</span>
            <span>Job scheduling, photos, and work logs</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-green-600">&#10003;</span>
            <span>One-click invoicing with Stripe payments</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-green-600">&#10003;</span>
            <span>AI assistant that understands your business</span>
          </li>
        </ul>

        <div className="mt-8">
          <Link
            href={signupUrl}
            className="inline-flex items-center justify-center rounded-md bg-[#0a0a0a] px-8 py-3 text-base font-medium text-white transition-colors hover:bg-[#0a0a0a]/90"
          >
            {refCode ? 'Start your free 14-day trial' : 'Get started for free'}
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required. Set up in under 5 minutes.
        </p>
      </div>
    </div>
  );
}
