/**
 * Status-aware tone for budget progress / consumed bars.
 *
 * Rust never fills a budget bar — rust is reserved for action / alarm
 * (CTAs, the over-budget flag). The neutral progress bar caused false
 * alarms ("uh oh / overspent" reading) for on-track projects. The bars
 * are now driven by % consumed:
 *
 *   - < 85%  → ok (emerald) — on track
 *   - ≥ 85%  → warn (amber) — nearing
 *   - ≥ 100% → danger (red) — over
 *
 * Spec lineage: card `da5bd4a0` §1 + OD render
 * `od-project-hub/screens/desktop-budget.html` (`.progress-stack.is-ok|is-warn|is-danger`).
 */

export type BudgetBarTone = 'ok' | 'warn' | 'danger';

export function budgetBarTone(consumedPct: number): BudgetBarTone {
  if (consumedPct >= 100) return 'danger';
  if (consumedPct >= 85) return 'warn';
  return 'ok';
}

/**
 * Tailwind class pairs for each tone:
 *   - `spent` is the fully-saturated fill (left segment)
 *   - `committed` is a lower-density companion (middle segment)
 *   - `swatchSpent` / `swatchCommitted` are smaller versions for legends
 *
 * Arbitrary hex values match the OD spec (`--ok-fill`, `--ok-fill-mid`,
 * etc.) verbatim so the bar reads identical to the design render.
 */
export const BUDGET_BAR_CLASSES: Record<
  BudgetBarTone,
  { spent: string; committed: string; swatchSpent: string; swatchCommitted: string }
> = {
  ok: {
    spent: 'bg-[#15803D]',
    committed: 'bg-[#4FA46B]',
    swatchSpent: 'bg-[#15803D]',
    swatchCommitted: 'bg-[#4FA46B]',
  },
  warn: {
    spent: 'bg-[#B45309]',
    committed: 'bg-[#D69147]',
    swatchSpent: 'bg-[#B45309]',
    swatchCommitted: 'bg-[#D69147]',
  },
  danger: {
    spent: 'bg-[#B91C1C]',
    committed: 'bg-[#D67A7A]',
    swatchSpent: 'bg-[#B91C1C]',
    swatchCommitted: 'bg-[#D67A7A]',
  },
};
