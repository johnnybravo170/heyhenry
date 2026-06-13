/**
 * Dashboard banner nudging users to enroll in MFA during the grace period
 * (or flagging them as blocked once grace has elapsed).
 *
 * Server component — reads enforcement state directly. Renders nothing
 * when the user isn't required, is already enrolled, or is unauthenticated.
 */

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { getMfaEnforcement } from '@/lib/auth/mfa-enforcement';

export async function MfaEnforcementBanner() {
  const snap = await getMfaEnforcement();
  if (!snap?.required || snap.enrolled) return null;

  // White Ledger: status lives at the datum, not as a full-width panel wash.
  // A white row with a 2px colored left rule + a tinted key phrase, never a
  // tinted background band (DESIGN.md §Color roles).
  if (snap.blocked) {
    return (
      <div className="flex items-start gap-3 border-b border-l-2 border-l-destructive bg-card px-4 py-2.5 text-foreground text-sm md:px-6">
        <ShieldAlert className="mt-0.5 size-4 flex-shrink-0 text-destructive" />
        <div className="flex-1">
          <span className="font-semibold text-destructive">
            Two-factor authentication required.
          </span>{' '}
          <span className="text-muted-foreground">
            Sensitive actions (Stripe, team invites, data export) are paused until you set it up.
          </span>{' '}
          <Link href="/settings/security" className="font-medium text-foreground underline">
            Set up 2FA now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 border-b border-l-2 border-l-amber-500 bg-card px-4 py-2.5 text-foreground text-sm md:px-6">
      <AlertTriangle className="mt-0.5 size-4 flex-shrink-0 text-amber-600 dark:text-amber-500" />
      <div className="flex-1">
        <span className="font-semibold text-amber-700 dark:text-amber-400">
          {snap.graceDaysRemaining > 1
            ? `${snap.graceDaysRemaining} days`
            : snap.graceDaysRemaining === 1
              ? '1 day'
              : 'Today'}{' '}
          left to set up two-factor authentication.
        </span>{' '}
        <span className="text-muted-foreground">
          After that, sensitive actions will be paused until it&apos;s enabled.
        </span>{' '}
        <Link href="/settings/security" className="font-medium text-foreground underline">
          Set it up
        </Link>
      </div>
    </div>
  );
}
