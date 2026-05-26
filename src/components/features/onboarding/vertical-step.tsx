'use client';

/**
 * Step 1 — "What kind of work do you do?" Two keyboard-accessible card tiles
 * (renovation default + pressure washing). Selecting writes `tenants.vertical`
 * and re-seeds vertical-specific starter data when it changed from the signup
 * default. Skip keeps the renovation default.
 *
 * The selected tile carries the screen's ONE rust accent (ring + radio fill);
 * the Continue CTA stays ink.
 */

import { Check } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { type SelectableVertical, setOnboardingVerticalAction } from '@/server/actions/onboarding';
import { StepActions } from './onboarding-flow';

type Tile = {
  value: SelectableVertical;
  title: string;
  desc: string;
  chips: string[];
  isDefault?: boolean;
};

const TILES: Tile[] = [
  {
    value: 'renovation',
    title: 'General contracting / renovation',
    desc: 'Multi-trade projects with phases, change orders, draws, and a client portal.',
    chips: ['Projects', 'Estimates', 'Change orders', 'Draws'],
    isDefault: true,
  },
  // Other trades (pressure washing, tile, decks) aren't open yet — only the
  // general contracting / renovation vertical is offered at signup for now.
];

export function VerticalStep({
  initialVertical,
  onContinue,
  onSkip,
}: {
  initialVertical: SelectableVertical;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<SelectableVertical>(initialVertical);
  const [pending, startTransition] = useTransition();

  function handleContinue() {
    startTransition(async () => {
      const res = await setOnboardingVerticalAction(selected);
      if (!res.ok) {
        // Non-blocking: the owner can still proceed on the signup default.
        toast.error(res.error);
      }
      onContinue();
    });
  }

  return (
    <>
      <h1 className="text-[22px] leading-tight font-bold tracking-[-0.02em] text-foreground">
        What kind of work do you do?
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        We&apos;ll set up the right tools, taxes, and starter templates for your trade. You can
        switch this later.
      </p>

      <div className="mt-1 flex flex-col gap-2.5">
        {TILES.map((tile) => {
          const isSel = selected === tile.value;
          return (
            <button
              key={tile.value}
              type="button"
              aria-pressed={isSel}
              onClick={() => setSelected(tile.value)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3.5 text-left transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                isSel
                  ? 'border-brand ring-3 ring-brand/15'
                  : 'border-border hover:border-foreground/30',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border',
                  isSel ? 'border-brand bg-brand text-white' : 'border-border bg-card',
                )}
                aria-hidden
              >
                {isSel ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-base leading-tight font-bold tracking-[-0.01em] text-foreground">
                    {tile.title}
                  </span>
                  {tile.isDefault ? (
                    <span className="rounded bg-muted px-1.5 py-px font-mono text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                      Default
                    </span>
                  ) : null}
                </span>
                <span className="text-sm leading-snug text-foreground/80">{tile.desc}</span>
                <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {tile.chips.map((chip, i) => (
                    <span key={chip} className="inline-flex items-center gap-2">
                      {i > 0 ? <span className="text-muted-foreground/50">·</span> : null}
                      {chip}
                    </span>
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="px-0.5 text-xs leading-snug text-muted-foreground">
        You&apos;re set up for general contracting and renovation. More trades (pressure washing,
        tile, decks) are coming.
      </p>

      <StepActions
        primaryLabel="Continue"
        onPrimary={handleContinue}
        onSkip={onSkip}
        pending={pending}
      />
    </>
  );
}
