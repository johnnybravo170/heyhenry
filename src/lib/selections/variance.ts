/**
 * Allowance-vs-actual variance for project selections.
 *
 * Each selection carries an optional `allowance_cents` (the contractual
 * budget for that finish) and `actual_cost_cents` (what the client's choice
 * actually cost). Over-allowance is a margin / Change-Order event — the
 * client chose the $80/sqft tile against a $40 allowance.
 *
 * This module is the single source of truth for *labelling* that variance.
 * The cardinal rule (WCAG 1.4.1, and the OD render): variance is NEVER
 * communicated by colour alone. Every variance carries a verb-bearing label
 * ("+$1,200.00 over allowance" / "$67.50 under" / "On allowance" /
 * "No actual yet"). The `tone` is a hint for colour/glyph, paired with the
 * label — not a substitute for it.
 *
 * Used by:
 *   - the operator Selections tab (per-row delta + room roll-up + the Henry
 *     over-allowance nudge),
 *   - the client portal selections view (per-row delta + room roll-up vs
 *     THEIR actual — never margin / supplier cost).
 *
 * No tax math here — the selection allowance/actual are bare amounts; tax
 * flows through the cost line / CO, not the selection (brief §Financial).
 */

import { formatCurrency } from '@/lib/pricing/calculator';

export type VarianceTone = 'over' | 'under' | 'flat' | 'pending';

/** A labelled variance for a single selection. */
export type SelectionVariance = {
  tone: VarianceTone;
  /** The verb-bearing label — always present, never colour-only. */
  label: string;
  /** Signed delta in cents (actual − allowance). Null when not computable. */
  deltaCents: number | null;
  /** True when actual exceeds allowance — the CO/margin trigger. */
  isOverAllowance: boolean;
};

/**
 * Compute the labelled variance for one selection.
 *
 * Cases:
 *   - both null            → null (no variance to show at all)
 *   - allowance only       → "Allowance $X · no actual yet" (pending)
 *   - actual only          → "Cost $X · no allowance set" (flat)
 *   - actual > allowance   → "+$X over allowance" (over) — the CO trigger
 *   - actual < allowance   → "$X under" (under)
 *   - actual = allowance   → "On allowance" (flat)
 */
export function selectionVariance(
  allowanceCents: number | null,
  actualCents: number | null,
): SelectionVariance | null {
  if (allowanceCents == null && actualCents == null) return null;

  if (allowanceCents != null && actualCents == null) {
    return {
      tone: 'pending',
      label: `Allowance ${formatCurrency(allowanceCents)} · no actual yet`,
      deltaCents: null,
      isOverAllowance: false,
    };
  }

  if (allowanceCents == null && actualCents != null) {
    return {
      tone: 'flat',
      label: `Cost ${formatCurrency(actualCents)} · no allowance set`,
      deltaCents: null,
      isOverAllowance: false,
    };
  }

  // Both present.
  const allowance = allowanceCents as number;
  const actual = actualCents as number;
  const delta = actual - allowance;

  if (delta > 0) {
    return {
      tone: 'over',
      label: `+${formatCurrency(delta)} over allowance`,
      deltaCents: delta,
      isOverAllowance: true,
    };
  }
  if (delta < 0) {
    return {
      tone: 'under',
      label: `${formatCurrency(-delta)} under`,
      deltaCents: delta,
      isOverAllowance: false,
    };
  }
  return {
    tone: 'flat',
    label: 'On allowance',
    deltaCents: 0,
    isOverAllowance: false,
  };
}

/** Roll-up across a set of selections (a room, or the whole project). */
export type VarianceRollup = {
  /** Σ allowance over selections that have an allowance set. */
  totalAllowanceCents: number;
  /** Σ actual over selections that have an actual set. */
  totalActualCents: number;
  /**
   * Net variance in cents. Only sums selections where BOTH allowance and
   * actual are known, so a TBD actual doesn't read as "$X under". Null when
   * no selection has a comparable pair.
   */
  netVarianceCents: number | null;
  tone: VarianceTone;
  /** The verb-bearing roll-up label — never colour-only. */
  label: string;
  /** How many selections are over their allowance — drives the CO nudge. */
  overCount: number;
  /** How many selections are in the roll-up (priced + unpriced). */
  selectionCount: number;
  /** How many have a comparable allowance+actual pair. */
  pricedCount: number;
};

export function rollupVariance(
  selections: ReadonlyArray<{
    allowance_cents: number | null;
    actual_cost_cents: number | null;
  }>,
  /** Used in the label, e.g. "Room is …" vs "Across all rooms …". */
  scopeWord: 'Room' | 'Project' = 'Room',
): VarianceRollup {
  let totalAllowance = 0;
  let totalActual = 0;
  let net = 0;
  let pricedCount = 0;
  let overCount = 0;

  for (const sel of selections) {
    if (sel.allowance_cents != null) totalAllowance += sel.allowance_cents;
    if (sel.actual_cost_cents != null) totalActual += sel.actual_cost_cents;
    if (sel.allowance_cents != null && sel.actual_cost_cents != null) {
      const d = sel.actual_cost_cents - sel.allowance_cents;
      net += d;
      pricedCount += 1;
      if (d > 0) overCount += 1;
    }
  }

  const netVarianceCents = pricedCount > 0 ? net : null;

  let tone: VarianceTone;
  let label: string;
  if (netVarianceCents == null) {
    tone = 'pending';
    label = `${scopeWord} — no actuals priced yet`;
  } else if (netVarianceCents > 0) {
    tone = 'over';
    label = `${scopeWord} is +${formatCurrency(netVarianceCents)} over allowance`;
  } else if (netVarianceCents < 0) {
    tone = 'under';
    label = `${scopeWord} is ${formatCurrency(-netVarianceCents)} under allowance`;
  } else {
    tone = 'flat';
    label = `${scopeWord} is on allowance`;
  }

  return {
    totalAllowanceCents: totalAllowance,
    totalActualCents: totalActual,
    netVarianceCents,
    tone,
    label,
    overCount,
    selectionCount: selections.length,
    pricedCount,
  };
}
