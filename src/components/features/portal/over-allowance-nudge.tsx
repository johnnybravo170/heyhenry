'use client';

/**
 * Henry over-allowance nudge — deterministic, labeled, dismissible.
 *
 * Shows ONLY when one or more selections are over their allowance. It's
 * computed deterministically from allowance vs actual (no model call), names
 * the offending selections + their overage, and offers a single "Draft
 * Change Order" link prefilled with the over-allowance context. Henry never
 * auto-creates the CO — the operator authors the cost impact and approves it.
 *
 * Operator-only: this surface never renders on the client portal (the portal
 * view has no "Start CO" affordance — see CLIENT BOUNDARY in the brief).
 *
 * Dismiss is local (session) — a calm nudge, not a blocking banner. Matches
 * the Henry ✦ eyebrow treatment from `henry-insight-strip.tsx`.
 */

import { ArrowUpRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/pricing/calculator';

export type OverAllowanceItem = {
  room: string;
  /** Display name — brand + name, falls back to category. */
  label: string;
  allowanceCents: number;
  overByCents: number;
};

export function OverAllowanceNudge({
  projectId,
  items,
}: {
  projectId: string;
  items: OverAllowanceItem[];
}) {
  const [dismissed, setDismissed] = useState(false);
  if (items.length === 0 || dismissed) return null;

  // Lead with the biggest overage — that's the one most worth a CO.
  const ranked = [...items].sort((a, b) => b.overByCents - a.overByCents);
  const lead = ranked[0];
  const second = ranked[1];
  const rooms = Array.from(new Set(ranked.map((i) => i.room)));

  const title = `Selections over allowance — ${ranked.length} ${ranked.length === 1 ? 'item' : 'items'}`;
  const reason = ranked
    .map(
      (i) =>
        `${i.label} (${i.room}) is ${formatCurrency(i.overByCents)} over its ${formatCurrency(i.allowanceCents)} allowance.`,
    )
    .join(' ');
  const params = new URLSearchParams({ from: 'selection', title, reason });
  const coHref = `/projects/${projectId}/change-orders/new?${params.toString()}`;

  return (
    <section
      aria-label="Henry: over-allowance change-order nudge"
      className="overflow-hidden rounded-lg border border-brand/20 bg-[#FEF0E3]"
    >
      <div className="flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-brand">
            Henry · over-allowance check
            <span className="font-normal normal-case text-muted-foreground">
              deterministic · allowance vs actual
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-foreground">
            <b>{lead.label}</b> is{' '}
            <span className="font-mono font-bold text-rose-800">
              +{formatCurrency(lead.overByCents)}
            </span>{' '}
            over its{' '}
            <span className="font-mono tabular-nums">{formatCurrency(lead.allowanceCents)}</span>{' '}
            allowance.
            {second ? (
              <>
                {' '}
                <b>{second.label}</b> is{' '}
                <span className="font-mono font-bold text-rose-800">
                  +{formatCurrency(second.overByCents)}
                </span>{' '}
                over.
              </>
            ) : null}{' '}
            {ranked.length > 1
              ? 'Start a single Change Order covering them?'
              : 'Start a Change Order to recover it?'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
          <Button asChild size="sm" variant="destructive" className="h-8 gap-1 text-xs">
            <Link href={coHref}>
              <ArrowUpRight className="size-3.5" aria-hidden />
              Draft Change Order
            </Link>
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-brand/15 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>
          {ranked.length} {ranked.length === 1 ? 'selection' : 'selections'} · {rooms.join(' · ')}
        </span>
        <span aria-hidden>·</span>
        <span>CO requires your sign-off before sending</span>
        <span aria-hidden>·</span>
        <span>Henry never auto-commits this</span>
      </div>
    </section>
  );
}
