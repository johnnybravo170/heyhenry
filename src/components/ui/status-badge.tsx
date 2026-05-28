/**
 * Canonical status chip for lifecycle / state labels.
 *
 * All per-feature status badges (invoice, quote, project, job, task, …)
 * are thin wrappers around this component. Centralising the chip shape here
 * means it can't drift between features.
 *
 * Shape: Paper eyebrow — 11px JetBrains Mono, uppercase, tracking-[0.06em],
 * soft-pair fill via `statusToneClass` from `status-tokens.ts`. Never rust
 * (rust = ✦ Henry + one hero CTA only, DESIGN.md).
 *
 * Dot-prefix variant ("• Active") — use `dot={true}` for live-state chips.
 * Icon variant — pass a Lucide `icon` for WCAG SC 1.4.1 compliance (don't
 * rely on colour alone for meaning). Prefer icons on task/job states that
 * have a clear glyph; prefer dot on simple binary live/inactive states.
 *
 * Extra HTML span attrs (data-*, title, aria-*) are forwarded via ...props.
 */

import type { LucideIcon } from 'lucide-react';
import type { StatusTone } from '@/lib/ui/status-tokens';
import { statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';

/**
 * Canonical pill SHAPE — colour-free. Shared between <StatusBadge> and any
 * sibling pill primitive (e.g. <SourcePill>) so every chip on every screen
 * lands at the exact same size + radius + type treatment. NEVER inline this
 * spec in a span; route through a primitive that imports `pillShape`.
 *
 * `!text-eyebrow` is important on purpose: every `statusToneClass[*]` value
 * ships a `text-<colour>-<n>` class, which `tailwind-merge` (via `cn`) treats
 * as the same `text-*` group and silently strips `text-eyebrow`. Without the
 * `!` the pill inherits the parent font-size — that's why pills have been
 * rendering at 14/16/20px depending on context instead of the canonical 11.
 */
export const pillShape =
  'inline-flex items-center gap-1 rounded px-[7px] py-0.5 ' +
  'font-mono !text-eyebrow font-bold uppercase tracking-[0.06em]';

export function StatusBadge({
  tone,
  label,
  children,
  icon: Icon,
  dot = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone: StatusTone;
  /** Text label. Overridden by `children` when you need responsive wrapping. */
  label?: string;
  icon?: LucideIcon;
  dot?: boolean;
}) {
  return (
    <span
      data-slot="status-badge"
      className={cn(pillShape, statusToneClass[tone], className)}
      {...props}
    >
      {dot ? <span aria-hidden="true">•</span> : null}
      {Icon && !dot ? <Icon aria-hidden="true" className="size-2.5 shrink-0" /> : null}
      {children ?? label}
    </span>
  );
}
