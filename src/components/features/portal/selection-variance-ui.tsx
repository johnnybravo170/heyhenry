/**
 * Presentational helpers for selection allowance-vs-actual variance.
 *
 * The variance *logic* lives in `@/lib/selections/variance` (pure, unit-
 * tested). This module is the shared *rendering* layer — the soft-pair
 * Paper tokens + glyphs — so the operator tab and the client portal render
 * variance identically and can't drift.
 *
 * WCAG 1.4.1 discipline: every pill carries a glyph + a verb-bearing label,
 * never colour alone. Soft pairs follow the live status-token convention
 * (`@/lib/ui/status-tokens`): over = danger (rose, the rust-soft analogue),
 * under = success (emerald, the ok-soft analogue), flat/pending = neutral.
 */

import { ArrowDown, ArrowUp, Minus, ShieldCheck, Sparkles, User } from 'lucide-react';
import type { ProjectSelection } from '@/lib/db/queries/project-selections';
import type { VarianceTone } from '@/lib/selections/variance';
import { cn } from '@/lib/utils';

/**
 * Soft-pair pill classes per variance tone. These reuse the same Tailwind
 * soft pairs the app's status tokens use so the eye stays trained — the OD
 * `--rust-soft`/`--ok-soft` map to the rose/emerald soft pairs already live
 * across Budget/Spend/CO surfaces.
 */
const toneClass: Record<VarianceTone, string> = {
  over: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  under: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  flat: 'bg-muted text-muted-foreground',
  pending: 'bg-muted text-muted-foreground',
};

function ToneGlyph({ tone }: { tone: VarianceTone }) {
  if (tone === 'over') return <ArrowUp className="size-3" aria-hidden />;
  if (tone === 'under') return <ArrowDown className="size-3" aria-hidden />;
  return <Minus className="size-3" aria-hidden />;
}

/**
 * The variance delta pill — glyph + label. The label is authored by
 * `selectionVariance` / `rollupVariance` and is always a full verb-bearing
 * string (e.g. "+$1,200.00 over allowance"), so this is colour-redundant,
 * not colour-only.
 */
export function VarianceDelta({
  tone,
  label,
  className,
}: {
  tone: VarianceTone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wide tabular-nums',
        toneClass[tone],
        className,
      )}
    >
      <ToneGlyph tone={tone} />
      {label}
    </span>
  );
}

/**
 * Dual-authoring "by" tag. Three legible variants, each a label + glyph
 * (never colour-only):
 *   - operator-spec  — the operator catalogued the install spec
 *   - by-client      — the client posted "what I chose" via the portal
 *   - by-promoted    — promoted from a client idea (one-way)
 *
 * `promoted` wins over the raw `created_by` because a promoted selection is
 * the more specific provenance signal.
 */
export function ByTag({
  createdBy,
  promoted,
  /** "By you" instead of "By client" on the client's own portal view. */
  selfLabel,
  className,
}: {
  createdBy: ProjectSelection['created_by'];
  promoted?: boolean;
  selfLabel?: boolean;
  className?: string;
}) {
  const base =
    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wide';

  if (promoted) {
    return (
      <span
        className={cn(
          base,
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
          className,
        )}
      >
        <Sparkles className="size-3" aria-hidden />
        Promoted from idea
      </span>
    );
  }
  if (createdBy === 'customer') {
    return (
      <span
        className={cn(
          base,
          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          className,
        )}
      >
        <User className="size-3" aria-hidden />
        {selfLabel ? 'By you' : 'By client'}
      </span>
    );
  }
  return (
    <span className={cn(base, 'bg-muted text-muted-foreground', className)}>
      <ShieldCheck className="size-3" aria-hidden />
      Operator-spec
    </span>
  );
}
