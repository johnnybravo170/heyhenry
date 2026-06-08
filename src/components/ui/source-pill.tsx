/**
 * Source-tint pill — identifies the cost SOURCE on ledger / actuals rows
 * (Labour / Bill / Expense / PO / Quote). Sibling to <StatusBadge>: shares the
 * exact pill SHAPE via `pillShape`, but uses the source-tint palette
 * (`--src-*` in globals.css) instead of `statusToneClass`. Kept as a separate
 * primitive so the StatusTone enum stays clean (source ≠ status).
 *
 * NEVER hand-roll a chip with these colours; route through this component so
 * shape can't drift between callers.
 */

import { pillShape } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

export type SourceKind = 'labour' | 'bill' | 'expense' | 'po' | 'quote';

/** Canonical label for each source kind. Callers can override via children. */
export const sourceKindLabel: Record<SourceKind, string> = {
  labour: 'Labour',
  bill: 'Bill',
  expense: 'Expense',
  po: 'PO',
  quote: 'Quote',
};

/**
 * Tint classes, wired to the --src-* tokens in globals.css. PO + Quote both
 * inherit the Bill family (committed-but-not-spent vs vendor-priced-not-yet-
 * committed); their distinct tokens just nudge lightness so they read as
 * cousins, never as a 5th hue. The OD render specifies labour/bill/expense
 * only — po/quote follow the OD's "bill family" comment.
 */
const sourceKindClass: Record<SourceKind, string> = {
  labour: 'bg-[var(--src-labour-bg)] text-[var(--src-labour-ink)]',
  bill: 'bg-[var(--src-bill-bg)] text-[var(--src-bill-ink)]',
  expense: 'bg-[var(--src-expense-bg)] text-[var(--src-expense-ink)]',
  po: 'bg-[var(--src-po-bg)] text-[var(--src-po-ink)]',
  quote: 'bg-[var(--src-bill-bg)] text-[var(--src-bill-ink)]',
};

export function SourcePill({
  kind,
  label,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  kind: SourceKind;
  /** Text label. Defaults to the canonical label for `kind`. */
  label?: string;
}) {
  return (
    <span
      data-slot="source-pill"
      className={cn(pillShape, sourceKindClass[kind], className)}
      {...props}
    >
      {children ?? label ?? sourceKindLabel[kind]}
    </span>
  );
}
