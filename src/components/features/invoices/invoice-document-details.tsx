'use client';

import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * "Document details" disclosure — folds the per-invoice payment
 * instructions / terms / policies config (defaults-setup nudge +
 * overrides editor) into ONE collapse. Restyle (UX redesign): these are
 * config, not the main task, so they no longer stack as two separate
 * banners under the actions. The customer-view preview / breakdown is the
 * hero; this is detail-tier progressive disclosure.
 *
 * The two editors are passed as children so this component owns only the
 * fold chrome — no duplicated form/save logic.
 *
 * `defaultOpen` opens it on first paint when something needs attention
 * (missing tenant defaults or an active per-invoice override) so the
 * operator isn't surprised at send time.
 */
export function InvoiceDocumentDetails({
  needsAttention,
  statusLabel,
  children,
}: {
  /** Open on first paint (missing defaults or an active override). */
  needsAttention: boolean;
  /** Right-aligned meta, e.g. "Using tenant defaults" / "2 overrides active". */
  statusLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(needsAttention);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border bg-card"
      data-slot="invoice-document-details"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-left">
        <ChevronRight
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90 text-foreground',
          )}
        />
        <div className="flex-1">
          <div className="text-sm font-semibold">Document details</div>
          <div className="text-xs text-muted-foreground">
            Payment instructions, terms, and policies for this invoice
          </div>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span
            aria-hidden
            className={cn(
              'inline-block size-1.5 rounded-full',
              needsAttention ? 'bg-amber-500' : 'bg-emerald-500',
            )}
          />
          {statusLabel}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t bg-muted/30 p-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
