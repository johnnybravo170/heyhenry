'use client';

/**
 * Step 3 — "Meet Henry." An orientation CARD, not a chat box: a ✦-marked line
 * in Henry's voice + 3 capability bullets tied to real embedded features. No
 * input field, no bubble — this orients, it doesn't converse (per
 * henry-intelligence-not-chat). The ✦ mark is the screen's one rust accent;
 * the "Let's go" CTA stays ink.
 */

import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BULLETS: Array<{ strong: string; rest: string }> = [
  {
    strong: 'Draft an estimate',
    rest: 'from a voice note or a photo of your scope sketch.',
  },
  {
    strong: 'Follow up',
    rest: 'on a sent estimate before it goes cold — in your voice.',
  },
  {
    strong: 'Flag an invoice',
    rest: 'drifting past due, with the next nudge ready to send.',
  },
];

export function MeetHenryStep({
  onFinish,
  finishing,
}: {
  onFinish: () => void;
  finishing: boolean;
}) {
  return (
    <>
      <h1 className="text-[22px] leading-tight font-bold tracking-[-0.02em] text-foreground">
        Meet Henry.
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your back-office assistant. Ask him anything from the corner, or let him work in the
        background. Here&apos;s what he&apos;ll do.
      </p>

      <div className="flex flex-col gap-2.5 rounded-xl border border-brand/20 bg-brand/[0.06] p-3.5">
        <div className="flex items-center gap-2">
          <span
            className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-card text-sm text-brand"
            aria-hidden
          >
            ✦
          </span>
          <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-brand uppercase">
            Henry
          </span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/80">
          <span className="font-semibold text-foreground">I&apos;m Henry.</span> I&apos;ll draft
          your quotes, chase late invoices, and keep the paperwork straight so you can stay on the
          tools.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {BULLETS.map((b) => (
          <li
            key={b.strong}
            className="flex items-start gap-2.5 text-sm leading-normal text-foreground/80"
          >
            <span
              className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
              aria-hidden
            >
              <Check className="size-3" strokeWidth={2.5} />
            </span>
            <span>
              <strong className="font-semibold text-foreground">{b.strong}</strong> {b.rest}
            </span>
          </li>
        ))}
      </ul>

      <p className="px-0.5 text-xs leading-relaxed text-muted-foreground">
        Tap the <span className="font-semibold text-brand">✦ Henry</span> button in the corner to
        ask him anything. He&apos;ll also surface right where you need him: on an estimate, on the
        dashboard, on a late invoice.
      </p>

      <div className="-mx-4 mt-1 flex flex-col gap-2 border-t px-4 pt-3">
        <Button type="button" className="h-11 w-full" onClick={onFinish} disabled={finishing}>
          {finishing ? 'Setting things up…' : "Let's go"}
          {!finishing ? <ArrowRight className="size-4" aria-hidden /> : null}
        </Button>
      </div>
    </>
  );
}
