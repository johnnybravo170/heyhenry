import { type ChangeOrderAction, changeOrderActionStyle } from '@/lib/ui/change-order-action';
import { cn } from '@/lib/utils';

/**
 * The diff-action pill — one tone + label + glyph per edit-action type.
 * Sourced from `change-order-action.ts` (the intentional palette, SEPARATE
 * from lifecycle status-tokens). Used in both the operator editor and the
 * customer-facing public diff view so the visual vocabulary is identical.
 *
 * `count` renders a summary chip ("3 Added") for the public diff header.
 */
export function ChangeOrderActionChip({
  action,
  count,
  className,
}: {
  action: ChangeOrderAction;
  count?: number;
  className?: string;
}) {
  const style = changeOrderActionStyle[action];
  // Summary chips read "3 ADDED · 1 CHANGED · 1 REMOVED · 1 BUDGET" (OD).
  // Budget is a noun; the others get a past-tense verb form.
  const summaryWord =
    action === 'add'
      ? 'Added'
      : action === 'modify'
        ? 'Changed'
        : action === 'remove'
          ? 'Removed'
          : 'Budget';
  const label = count !== undefined ? `${count} ${summaryWord}` : style.label;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
        style.chipClass,
        className,
      )}
    >
      <span aria-hidden className="text-xs leading-none">
        {style.glyph}
      </span>
      {label}
    </span>
  );
}
