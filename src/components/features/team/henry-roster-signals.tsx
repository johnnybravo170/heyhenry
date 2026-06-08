'use client';

/**
 * "Henry noticed" — read-only roster-gap signals (gap 6). Never auto-edits;
 * surfaces things worth fixing: a subcontractor missing a GST # (year-end
 * T5018), a worker with no pay rate (their time costs Labour at $0), and
 * invites about to expire. Labelled, dismissable, no actions of its own.
 *
 * Signals are computed server-side and passed in as plain strings so this
 * stays a thin presentational shell.
 */

import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function HenryRosterSignals({ signals }: { signals: string[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || signals.length === 0) return null;

  return (
    <div
      role="note"
      className="grid grid-cols-[24px_1fr_auto] items-start gap-3 rounded-xl border border-brand/20 border-l-[3px] border-l-brand bg-brand/5 px-4 py-3"
    >
      <span className="mt-0.5 grid size-6 place-items-center rounded-md bg-white text-brand">
        <Sparkles className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <span className="mb-1 inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-brand">
          Henry{' '}
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            noticed
          </span>
        </span>
        <ul className="flex flex-col gap-1 text-sm leading-relaxed text-foreground/80">
          {signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => setDismissed(true)}
        title="Dismiss"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
