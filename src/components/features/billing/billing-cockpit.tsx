'use client';

/**
 * Billing cockpit — three actionable numbers (owner/admin only).
 *
 *   Ready to bill (rust accent / peach) → earned-but-unbilled work; the
 *     proactive cash prompt. Clears the status filter so ready projects (which
 *     sort to the top) lead the list.
 *   Outstanding → money on the street (sent, unpaid); filters to Sent.
 *   Overdue (danger) → the aged chase subset; filters to Overdue.
 *
 * Each tile is a real button (a filtered link) — keyboard reachable, preserves
 * the active search term. "Collected this month" is deliberately absent: it's
 * a monitoring number that lives on Business Health, not the AR worklist.
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Money } from '@/components/ui/money';
import type { BillingCockpit as Cockpit } from '@/lib/db/queries/billing';
import { cn } from '@/lib/utils';

function pluralize(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

export function BillingCockpit({ cockpit }: { cockpit: Cockpit }) {
  const searchParams = useSearchParams();

  function href(status: string | null): string {
    const params = new URLSearchParams(searchParams?.toString());
    if (status) params.set('status', status);
    else params.delete('status');
    params.delete('page');
    const qs = params.toString();
    return qs ? `/invoices?${qs}` : '/invoices';
  }

  const allCaughtUp =
    cockpit.ready_to_bill_cents === 0 &&
    cockpit.outstanding_cents === 0 &&
    cockpit.overdue_cents === 0;

  if (allCaughtUp) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4">
        <span className="text-sm font-medium">All caught up</span>
        <span className="text-sm text-muted-foreground">
          Nothing outstanding and nothing waiting to be billed.
        </span>
      </div>
    );
  }

  const readySub =
    cockpit.ready_project_count > 0
      ? `${pluralize(cockpit.ready_project_count, 'project')} ready`
      : 'Nothing waiting';
  const outstandingSub =
    cockpit.outstanding_count > 0
      ? `${pluralize(cockpit.outstanding_count, 'invoice')} · ${pluralize(cockpit.outstanding_project_count, 'project')}`
      : 'None on the street';
  const overdueSub =
    cockpit.overdue_count > 0
      ? `${pluralize(cockpit.overdue_count, 'invoice')} · ${cockpit.overdue_max_days}d late`
      : 'None overdue';

  return (
    <section aria-label="Billing cockpit" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Tile
        href={href(null)}
        label="Ready to bill"
        cents={cockpit.ready_to_bill_cents}
        sub={readySub}
        tone="ready"
      />
      <Tile
        href={href('sent')}
        label="Outstanding"
        cents={cockpit.outstanding_cents}
        sub={outstandingSub}
        tone="neutral"
      />
      <Tile
        href={href('overdue')}
        label="Overdue"
        cents={cockpit.overdue_cents}
        sub={overdueSub}
        tone="danger"
      />
    </section>
  );
}

function Tile({
  href,
  label,
  cents,
  sub,
  tone,
}: {
  href: string;
  label: string;
  cents: number;
  sub: string;
  tone: 'ready' | 'neutral' | 'danger';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-[100px] flex-col gap-1.5 rounded-xl border p-4 transition-colors',
        tone === 'ready'
          ? 'border-brand/25 bg-[#FEF0E3] hover:border-brand/50 hover:bg-[#FBE4CF]'
          : 'bg-card hover:bg-accent',
      )}
    >
      <span
        className={cn(
          'font-mono text-[11px] font-semibold uppercase tracking-wide',
          tone === 'ready' ? 'text-brand' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      <Money
        cents={cents}
        className={cn(
          'text-3xl font-bold leading-none',
          tone === 'ready' && 'text-brand',
          tone === 'danger' && 'text-red-700 dark:text-red-400',
        )}
      />
      <span
        className={cn(
          'mt-0.5 text-xs',
          tone === 'ready' ? 'font-medium text-brand' : 'text-muted-foreground',
        )}
      >
        {sub}
      </span>
    </Link>
  );
}
