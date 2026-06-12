/**
 * White Ledger label — 12px Inter, sentence case, muted tone.
 *
 * DESIGN.md v2 (June 2026): the JetBrains-Mono uppercase eyebrow tier is
 * retired. Labels are now Inter 12px/500, sentence case — "Remaining", not
 * "REMAINING". One component, one treatment. JetBrains Mono is reserved only
 * for literal id chips (e.g. #a3f2).
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
      className={cn('text-meta font-medium tracking-[-0.005em] text-muted-foreground', className)}
    >
      {children}
    </Tag>
  );
}
