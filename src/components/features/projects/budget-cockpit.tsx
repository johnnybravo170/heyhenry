/**
 * Budget tab cockpit — the regions above the scope table.
 *   1. BudgetAlertChips    — exception flags (margin-at-risk, unsent scope).
 *   2. BudgetPositionStrip — ledger equation: Estimate − Spent − Committed =
 *      Remaining, with a 4px status-aware bar. Renders only when spending has
 *      started (Spent+Committed > 0). DESIGN.md v2 "White Ledger": replaces
 *      the 4-column scorecard.
 *      OD reference: od-project-hub/screens/budget-flat.html §position-strip
 *
 * Server components (static, no interactivity beyond links).
 */

import { AlertTriangle, ArrowRight, Shuffle } from 'lucide-react';
import Link from 'next/link';
import { Money } from '@/components/ui/money';
import { BUDGET_BAR_CLASSES, budgetBarTone } from '@/lib/budget/bar-tone';
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

/**
 * Position strip — the ledger equation above the budget table.
 *
 * Estimate − Spent − Committed = Remaining, with a 4px status-aware bar.
 * Sits on the page background (no card), has a bottom hairline.
 * Renders null when no spending has started (Spent+Committed === 0).
 *
 * DESIGN.md v2: replaces the 4-column scorecard. The equation is its own
 * legend (dots on Spent + Committed labels carry bar segment tones).
 * Healthy = silent; no percentages unless inverted (handled by BudgetAlertChips).
 */
export function BudgetPositionStrip({
  projectId,
  estimateCents,
  spentCents,
  committedCents,
  remainingCents,
}: {
  projectId: string;
  estimateCents: number;
  spentCents: number;
  committedCents: number;
  remainingCents: number;
}) {
  const used = spentCents + committedCents;
  if (used === 0) return null;

  const basis = Math.max(estimateCents, used, 1);
  const spentW = `${(Math.min(spentCents, basis) / basis) * 100}%`;
  const committedW = `${(Math.min(committedCents, Math.max(0, basis - spentCents)) / basis) * 100}%`;
  const consumedPct = estimateCents > 0 ? Math.round((used / estimateCents) * 100) : 0;
  const tone = budgetBarTone(consumedPct);
  const toneClasses = BUDGET_BAR_CLASSES[tone];

  const isDanger = remainingCents < 0;

  return (
    <div className="border-b px-4 pb-3 pt-3.5">
      {/* Equation line */}
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <EquationTerm label="Estimate" cents={estimateCents} />
        <EquationOp>−</EquationOp>
        <EquationTerm label="Spent" cents={spentCents} dotClass={toneClasses.swatchSpent} />
        <EquationOp>−</EquationOp>
        <EquationTerm
          label="Committed"
          cents={committedCents}
          dotClass={toneClasses.swatchCommitted}
        />
        <EquationOp>=</EquationOp>
        <EquationTerm label="Remaining" cents={remainingCents} isResult danger={isDanger} />
        <Link
          href={`/projects/${projectId}?tab=overview`}
          className="ml-auto text-meta font-medium text-muted-foreground hover:text-foreground"
        >
          Variance →
        </Link>
      </div>

      {/* 4px status-aware bar */}
      <div className="flex h-[4px] overflow-hidden rounded-full bg-muted">
        <span className={cn('block h-full', toneClasses.spent)} style={{ width: spentW }} />
        <span className={cn('block h-full', toneClasses.committed)} style={{ width: committedW }} />
      </div>
    </div>
  );
}

function EquationTerm({
  label,
  cents,
  dotClass,
  isResult = false,
  danger = false,
}: {
  label: string;
  cents: number;
  dotClass?: string;
  isResult?: boolean;
  danger?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="inline-flex items-center gap-1 text-meta font-medium text-muted-foreground">
        {dotClass ? (
          <span className={cn('inline-block size-[6px] self-center rounded-full', dotClass)} />
        ) : null}
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums tracking-tight',
          isResult ? 'text-display-xs font-bold' : 'text-lead font-semibold',
          danger ? 'text-destructive' : 'text-foreground',
        )}
      >
        <Money cents={cents} whole />
      </span>
    </span>
  );
}

function EquationOp({ children }: { children: string }) {
  return (
    <span className="text-lead font-medium text-muted-foreground/50 tabular-nums">{children}</span>
  );
}
