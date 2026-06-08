'use client';

/**
 * Merged signed-estimate banner on the Budget tab. One slim row that
 * covers two states the older UI surfaced as separate banners:
 *
 *   1. The estimate is signed → working budget edits don't touch the
 *      customer's signed scope. (Was an amber "Estimate is approved"
 *      block inside the table.)
 *   2. N change orders have been applied → the visible numbers reflect
 *      post-CO state. (Was a separate blue "Reflects X applied COs"
 *      banner above.)
 *
 * Both messages collapse into a single row:
 *
 *   ✓ Estimate signed · 2 applied COs   [See history ▾]   [+ Change Order]
 *
 * Click "See history" to inline-expand the version timeline (every
 * signed estimate + applied CO).
 *
 * Hidden entirely when the estimate isn't approved yet.
 */

import { Check, ChevronDown, ChevronUp, ExternalLink, FileEdit } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import type { ProjectVersionListItem } from '@/lib/db/queries/project-versions';
import { withFrom } from '@/lib/nav/from-link';
import { formatCurrency } from '@/lib/pricing/calculator';
import { cn } from '@/lib/utils';

export function AppliedChangeOrdersBanner({
  estimateStatus,
  appliedCount,
  projectId,
  versions,
  customerName,
  approvedAt,
  baselineVersion,
  approvalCode,
}: {
  estimateStatus: string;
  appliedCount: number;
  projectId: string;
  versions: ProjectVersionListItem[];
  /** Who signed (customer). */
  customerName?: string | null;
  /** When the estimate was approved (ISO). */
  approvedAt?: string | null;
  /** Contract-baseline version number → "v{n}". */
  baselineVersion?: number | null;
  /** Public estimate code → "View signed PDF" deep-link. */
  approvalCode?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const tz = useTenantTimezone();

  // Banner only meaningful once the estimate is signed. Pre-approval
  // states have their own banners (EstimateSentBanner for pending).
  if (estimateStatus !== 'approved') return null;

  const hasHistory = appliedCount > 0;
  const approvedText = approvedAt
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(approvedAt))
    : null;
  const signedHref = approvalCode
    ? `/estimate/${approvalCode}`
    : `/projects/${projectId}/estimate/preview`;

  return (
    <div className="overflow-hidden rounded-xl border border-l-[3px] border-l-emerald-600 bg-card text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5">
        <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Check className="size-2.5" aria-hidden />
        </span>
        <span className="min-w-0">
          <strong className="font-semibold text-foreground">
            Estimate signed{customerName ? ` by ${customerName}` : ''}
          </strong>
          {approvedText ? `, ${approvedText}` : ''}
          {hasHistory ? (
            <>
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              <span className="font-semibold text-foreground">{appliedCount}</span> applied change{' '}
              {appliedCount === 1 ? 'order' : 'orders'}
            </>
          ) : null}
          {baselineVersion ? (
            <>
              <span className="mx-1.5 text-muted-foreground/50">·</span>contract baseline{' '}
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide text-foreground">
                v{baselineVersion}
              </span>
            </>
          ) : null}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {hasHistory ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide hover:bg-muted hover:text-foreground"
            >
              {expanded ? 'Hide history' : 'See history'}
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          ) : null}
          <Link
            href={signedHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground hover:underline"
          >
            View signed PDF <ExternalLink className="size-2.5 text-muted-foreground" />
          </Link>
          <Button asChild size="xs" variant="outline" className="bg-background">
            <Link href={`/projects/${projectId}/change-orders/new`}>
              <FileEdit className="size-3" />
              Change Order
            </Link>
          </Button>
        </div>
      </div>

      {expanded && hasHistory ? (
        <div className="border-t bg-muted/20 px-4 py-2">
          {versions.length === 0 ? (
            <p className="py-2 text-blue-800 dark:text-blue-200">
              No signed versions yet on this project.
            </p>
          ) : (
            <ol className="flex flex-col">
              {versions.map((v, i) => (
                <VersionRow
                  key={`v${v.version_number}-${v.signed_at}`}
                  version={v}
                  projectId={projectId}
                  isLast={i === versions.length - 1}
                />
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}

function VersionRow({
  version,
  projectId,
  isLast,
}: {
  version: ProjectVersionListItem;
  projectId: string;
  isLast: boolean;
}) {
  const tz = useTenantTimezone();
  const date = new Date(version.signed_at);
  const dateText = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  // Each row deep-links to the most relevant detail surface:
  //   - CO rows → CO detail page
  //   - v1 estimate row → estimate preview
  //   - legacy rows without snapshot or CO → no link
  const href = version.change_order_id
    ? withFrom(
        `/projects/${projectId}/change-orders/${version.change_order_id}`,
        `/projects/${projectId}?tab=budget`,
        'Budget',
      )
    : version.version_number === 1
      ? `/projects/${projectId}/estimate/preview`
      : null;

  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-[10px] font-semibold text-blue-900 dark:bg-blue-900 dark:text-blue-100',
          )}
        >
          v{version.version_number}
        </span>
        <span className="truncate font-medium">{version.label}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-blue-800/90 dark:text-blue-200/80">
        <span>
          {dateText}
          {version.signed_by_name ? ` · ${version.signed_by_name}` : ''}
        </span>
        {version.total_cents !== null ? (
          <span className="tabular-nums font-medium">{formatCurrency(version.total_cents)}</span>
        ) : null}
        {href ? <ExternalLink className="size-3 shrink-0 opacity-60" /> : null}
      </div>
    </>
  );

  const className = cn(
    'flex items-center justify-between gap-3 py-1.5',
    !isLast && 'border-b border-blue-200/40 dark:border-blue-900/40',
    href && 'hover:text-blue-950 dark:hover:text-white',
  );

  if (href) {
    return (
      <li>
        <Link href={href} className={className}>
          {inner}
        </Link>
      </li>
    );
  }
  return <li className={className}>{inner}</li>;
}
