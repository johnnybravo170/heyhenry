/**
 * The Paper "eyebrow" — the small uppercase mono label that sits over data
 * across the app ("REMAINING", "SPENT BY SOURCE", "CLIENT ESTIMATE · DRAFT").
 *
 * One place, one treatment (DESIGN.md §Typography): the closed-scale 11px mono
 * eyebrow step (`text-eyebrow`), one tracking (0.06em), one muted tone. Replaces
 * the per-file copy-pasted `font-mono` + arbitrary-11px + uppercase + muted
 * string so the eyebrow can't drift label-to-label.
 *
 * Renders a <span> by default; pass `as="p"` for a block label.
 */

import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Eyebrow({
  as: Tag = 'span',
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        'font-mono text-eyebrow uppercase tracking-[0.06em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
