import { statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import {
  type ContactKind,
  type CustomerType,
  contactKindLabels,
  customerTypeLabels,
} from '@/lib/validators/customer';

/**
 * Contact-kind pill. The column means **kind**, consistently — one calm
 * neutral treatment for every kind, because a category is not an action
 * (DESIGN.md: "color is reserved for action"). The one exception is `lead`,
 * which leans on the shared `warning` status tone ("warm, not closed yet")
 * because a lead *is* a thing to act on.
 *
 * The previous 8-hue rainbow was retired (PATTERNS.md §7 repaint, 2026-05):
 * sibling *status* badges — project / invoice / job / quote / change-order —
 * still carry color because they encode state, not category.
 *
 * Customer subtype (residential / commercial) is a quiet secondary cue, not a
 * second color — pass `withSubtype` to render it inline after the pill.
 */
export function CustomerTypeBadge({
  type,
  kind,
  withSubtype,
  className,
}: {
  type: CustomerType;
  /** Contact kind. Drives the label; defaults to a customer pill when absent. */
  kind?: ContactKind;
  /** When true and kind is customer, append the residential/commercial subtype. */
  withSubtype?: boolean;
  className?: string;
}) {
  const resolvedKind: ContactKind = kind ?? 'customer';
  const isLead = resolvedKind === 'lead';
  const showSubtype =
    withSubtype && resolvedKind === 'customer' && (type === 'residential' || type === 'commercial');

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        data-slot="customer-type-badge"
        data-kind={resolvedKind}
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
          isLead ? statusToneClass.warning : 'bg-muted text-muted-foreground ring-transparent',
        )}
      >
        {contactKindLabels[resolvedKind]}
      </span>
      {showSubtype ? (
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {customerTypeLabels[type]}
        </span>
      ) : null}
    </span>
  );
}
