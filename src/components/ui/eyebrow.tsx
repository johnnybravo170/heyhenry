/**
 * Paper mono eyebrow label — 11px JetBrains Mono, uppercase, semibold, muted.
 *
 * Used for the labeling device above data cells, panel sections, and metric
 * groups: "ESTIMATE", "REMAINING", "SCHEDULE", "SCOPE CHANGES", etc.
 *
 * This is NOT the prose/document eyebrow (see the private `Eyebrow` in
 * `customer-document.tsx`, which is 12px sans — a different surface).
 * This one is for operator-facing data chrome.
 *
 * The `as` prop lets callers choose the semantic element without sacrificing
 * visual consistency. Default is `<p>`; use `<span>` for inline, `<h2>`/`<h3>`
 * for accessible heading landmarks in panel headers.
 *
 * Weight default is `font-semibold` (600) — the most common in the design.
 * Override via `className` when `font-bold` (700) is called for by the OD.
 */

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type EyebrowTag = 'p' | 'span' | 'h2' | 'h3' | 'div';

export function Eyebrow({
  children,
  className,
  as: Tag = 'p',
}: {
  children: ReactNode;
  className?: string;
  /** Semantic element. Default `p`. Use `span` for inline, `h2`/`h3` for landmark heads. */
  as?: EyebrowTag;
}) {
  return (
    <Tag
      className={cn(
        'font-mono text-eyebrow font-semibold uppercase tracking-wide text-muted-foreground',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
