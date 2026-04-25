import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { SubscriptionStatus } from '@/lib/billing/features';

/**
 * Top-of-app banner shown when subscription is past_due / unpaid. Renders
 * nothing for healthy statuses. Place once in the authenticated app shell.
 */
export function PastDueBanner({ status }: { status: SubscriptionStatus }) {
  if (status !== 'past_due' && status !== 'unpaid') return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4" />
        <span>
          Your payment is past due. Growth, Pro, and Scale features are locked until billing is
          current.
        </span>
      </div>
      <Link
        href="/settings/billing"
        className="font-medium underline underline-offset-2 hover:no-underline"
      >
        Update billing
      </Link>
    </div>
  );
}
