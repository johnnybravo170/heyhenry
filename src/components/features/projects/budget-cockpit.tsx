/**
 * Budget tab cockpit — the regions above the scope table, per the Project Hub
 * budget OD (od-project-hub/screens/desktop-budget.html):
 *   1. BudgetAlertChips   — margin-at-risk + unsent-scope-changes chips.
 *   2. BudgetSummaryPanel — Estimate / Spent / Committed / Remaining + a
 *      "% complete · % of budget consumed" segmented progress stack + legend.
 *
 * Server components (static, no interactivity beyond links). Money renders CAD
 * with de-emphasized cents to match the OD's `$142,000.00` treatment.
 */

import { AlertTriangle, ArrowRight, Shuffle } from 'lucide-react';
import Link from 'next/link';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Money } from '@/components/ui/money';
import { cn } from '@/lib/utils';

export function BudgetAlertChips({
  projectId,
  marginPct,
  targetPct,
  marginAtRisk,
  unsentCount,
  unsentDeltaCents,
}: {
  projectId: string;
  /** Projected margin as a % of revenue. */
  marginPct: number | null;
  /** Target margin (management fee rate) as a %. */
  targetPct: number;
  /** True when margin is below target / negative — drives the danger chip. */
  marginAtRisk: boolean;
  unsentCount: number;
  unsentDeltaCents: number;
}) {
  const showMargin = marginAtRisk && marginPct !== null;
  const showUnsent = unsentCount > 0;
  if (!showMargin && !showUnsent) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showMargin ? (
        <Link
          href={`/projects/${projectId}?tab=overview`}
          className="inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-sm text-foreground hover:bg-destructive/15"
        >
          <span className="grid size-4 place-items-center rounded-full bg-destructive text-white">
            <AlertTriangle className="size-2.5" />
          </span>
          <span>
            <strong className="font-bold">Margin at risk</strong>
            <span className="mx-1 text-muted-foreground/60">·</span>
            <strong className="font-bold tabular-nums">{marginPct}%</strong> vs{' '}
            <strong className="font-bold tabular-nums">{targetPct}%</strong>
          </span>
          <ArrowRight className="size-3 text-muted-foreground" />
        </Link>
      ) : null}
      {showUnsent ? (
        <Link
          href={`/projects/${projectId}?tab=budget&review=scope`}
          className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-100 px-3 py-1.5 text-sm text-foreground hover:bg-amber-200/70"
        >
          <span className="grid size-4 place-items-center rounded-full bg-amber-600 text-white">
            <Shuffle className="size-2.5" />
          </span>
          <span>
            <strong className="font-bold">
              {unsentCount} unsent scope change{unsentCount === 1 ? '' : 's'}
            </strong>{' '}
            <span className="tabular-nums">
              {unsentDeltaCents >= 0 ? '+' : '−'}
              <Money cents={Math.abs(unsentDeltaCents)} />
            </span>
          </span>
          <ArrowRight className="size-3 text-muted-foreground" />
        </Link>
      ) : null}
    </div>
  );
}

function VarCell({ label, cents, sub }: { label: string; cents: number; sub: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Eyebrow className="font-semibold">{label}</Eyebrow>
      <span className="text-xl font-bold tabular-nums tracking-tight">
        <Money cents={cents} />
      </span>
      <Eyebrow>{sub}</Eyebrow>
    </div>
  );
}

export function BudgetSummaryPanel({
  projectId,
  estimateCents,
  spentCents,
  committedCents,
  remainingCents,
  workStatusPct,
  baselineVersion,
}: {
  projectId: string;
  estimateCents: number;
  spentCents: number;
  committedCents: number;
  remainingCents: number;
  /** 0-100 work-completion %. */
  workStatusPct: number;
  /** Contract baseline version label, e.g. 3 → "v3". Null when no snapshot. */
  baselineVersion: number | null;
}) {
  const used = spentCents + committedCents;
  const consumedPct = estimateCents > 0 ? Math.round((used / estimateCents) * 100) : 0;
  const basis = Math.max(estimateCents, used, 1);
  const spentW = `${(Math.min(spentCents, basis) / basis) * 100}%`;
  const committedW = `${(Math.min(committedCents, Math.max(0, basis - spentCents)) / basis) * 100}%`;
  const baseline = baselineVersion
    ? `Contract baseline · v${baselineVersion}`
    : 'Contract baseline';

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
        <span className="text-base font-bold tracking-tight">Budget summary</span>
        <Link
          href={`/projects/${projectId}?tab=overview`}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Variance by category <ArrowRight className="size-2.5" />
        </Link>
      </div>
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 items-baseline gap-4 sm:grid-cols-4">
          <VarCell label="Estimate" cents={estimateCents} sub={baseline} />
          <VarCell label="Spent" cents={spentCents} sub="Labour + bills" />
          <VarCell label="Committed" cents={committedCents} sub="Subs + open POs" />
          <VarCell label="Remaining" cents={remainingCents} sub="After committed" />
        </div>

        <div className="mt-4 border-t border-dashed pt-3.5">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              <strong className="font-bold tabular-nums text-foreground">{workStatusPct}%</strong>{' '}
              complete
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span>
              <strong className="font-bold tabular-nums text-foreground">{consumedPct}%</strong> of
              budget consumed
            </span>
            <span className="ml-auto font-mono text-eyebrow uppercase tracking-wide tabular-nums">
              <Money cents={used} /> of <Money cents={estimateCents} />
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <span className="block h-full bg-foreground" style={{ width: spentW }} />
            <span className="block h-full bg-[#7A6A4D]" style={{ width: committedW }} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Legend swatch="bg-foreground" label="Spent" cents={spentCents} />
            <Legend swatch="bg-[#7A6A4D]" label="Committed" cents={committedCents} />
            <Legend swatch="border bg-muted" label="Remaining" cents={remainingCents} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ swatch, label, cents }: { swatch: string; label: string; cents: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block size-2 rounded-sm', swatch)} />
      {label}{' '}
      <strong className="font-semibold tabular-nums text-foreground">
        <Money cents={cents} />
      </strong>
    </span>
  );
}
