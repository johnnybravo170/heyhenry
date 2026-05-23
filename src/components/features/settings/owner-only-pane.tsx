/**
 * Calm permission state for owner-only settings routes.
 *
 * A member or admin who deep-links an owner-only URL (e.g. /settings/billing)
 * gets this pane instead of a crash, a 403, or a silent redirect. The page
 * still enforces the role server-side — it just renders this in place of the
 * gated UI rather than throwing. Pairs with the nav role-filter (which stops
 * advertising the destination in the first place).
 *
 * One shared component across every gated route so the refusal reads
 * identically wherever a non-owner lands.
 */

import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function OwnerOnlyPane({
  /** What the locked page is, e.g. "Billing & subscription". */
  title,
  /** One-line explanation of what the owner handles here. */
  description,
  /** Owner's display name, woven into the description when provided. */
  ownerName,
}: {
  title: string;
  description: string;
  ownerName?: string | null;
}) {
  return (
    <div
      role="alert"
      aria-labelledby="owner-only-title"
      className="flex items-start gap-4 rounded-xl border bg-card p-8"
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Lock className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Owner only
        </div>
        <h2 id="owner-only-title" className="mb-1.5 text-base font-bold tracking-tight">
          {title}
        </h2>
        <p className="mb-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
          {ownerName ? <> Reach out to {ownerName} to make changes here.</> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/settings">
              <ArrowLeft className="size-4" />
              Back to settings
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
