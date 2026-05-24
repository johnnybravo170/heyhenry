'use client';

/**
 * First-run setup pass shell. Owns the step state (0 vertical → 1 profile →
 * 2 meet-Henry), the progress affordance, and Back/Skip wiring. Each step is
 * its own component; this shell is the resumable spine.
 *
 * SAFETY: every step is skippable and back-navigable, and "finish" always
 * calls completeOnboardingAction + routes to /dashboard. There is no path that
 * blocks the dashboard on profile completeness. Skip simply advances without
 * saving that step.
 *
 * Design: INK primary buttons + ink progress fill; the single rust accent is
 * the ✦ Henry mark + the selected-tile highlight only — never the CTA, never
 * the progress bar (per DESIGN.md one-accent discipline).
 */

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  completeOnboardingAction,
  type SelectableVertical,
  setOnboardingStepAction,
} from '@/server/actions/onboarding';
import { MeetHenryStep } from './meet-henry-step';
import { ProfileStep } from './profile-step';
import { VerticalStep } from './vertical-step';

const TOTAL_STEPS = 3;
const STEP_LABELS = ['Trade', 'Business profile', 'Meet Henry'] as const;

export type OnboardingProfile = {
  // Day-1 fields collected in step 2.
  gstNumber: string;
  wcbNumber: string;
  province: string;
  logoSignedUrl: string | null;
  // Passed through on save so we don't clobber Settings-managed fields.
  businessName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  phone: string;
  contactEmail: string;
  websiteUrl: string;
  reviewUrl: string;
};

type Props = {
  resumeStep: number;
  initialVertical: SelectableVertical;
  profile: OnboardingProfile;
};

export function OnboardingFlow({ resumeStep, initialVertical, profile }: Props) {
  const router = useRouter();
  // Clamp the resume marker into [0, TOTAL_STEPS - 1].
  const [step, setStep] = useState(() => Math.min(Math.max(resumeStep, 0), TOTAL_STEPS - 1));
  const [finishing, startFinish] = useTransition();

  /** Advance to `next`, recording the furthest-reached step for resume. */
  function goTo(next: number) {
    setStep(next);
    // Fire-and-forget: persisting the resume marker must never block the UI.
    void setOnboardingStepAction(next);
  }

  function handleNext() {
    if (step < TOTAL_STEPS - 1) goTo(step + 1);
    else finish();
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  /** Final hand-off: mark complete, then route to the dashboard FirstRunHero. */
  function finish() {
    startFinish(async () => {
      const res = await completeOnboardingAction();
      if (!res.ok) {
        // Don't trap the owner — surface the error but still let them through.
        toast.error(res.error);
      }
      router.push('/dashboard');
    });
  }

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
        <ProgressHeader step={step} onBack={step > 0 ? handleBack : undefined} />

        <div className="flex flex-col gap-3 px-4 py-4">
          {step === 0 ? (
            <VerticalStep
              initialVertical={initialVertical}
              onContinue={handleNext}
              onSkip={handleNext}
            />
          ) : null}
          {step === 1 ? (
            <ProfileStep profile={profile} onContinue={handleNext} onSkip={handleNext} />
          ) : null}
          {step === 2 ? <MeetHenryStep onFinish={finish} finishing={finishing} /> : null}
        </div>
      </div>
    </div>
  );
}

function ProgressHeader({ step, onBack }: { step: number; onBack?: () => void }) {
  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-mx-1.5 -my-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronLeft className="size-3" aria-hidden />
            Back
          </button>
        ) : (
          <span />
        )}
        <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Step <span className="text-foreground">{step + 1}</span> of {TOTAL_STEPS}
        </span>
      </div>
      {/* Ink fill on a paper track — NOT rust. */}
      <div
        className="flex h-1 gap-1"
        role="progressbar"
        aria-label={`Step ${step + 1} of ${TOTAL_STEPS}`}
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
      >
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <span
            key={STEP_LABELS[i]}
            className={cn(
              'h-1 flex-1 rounded-full',
              i < step ? 'bg-foreground' : i === step ? 'bg-foreground/60' : 'bg-muted',
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** Shared step footer: ink primary CTA + low-emphasis Skip link. */
export function StepActions({
  primaryLabel,
  onPrimary,
  onSkip,
  skipLabel,
  pending,
  primaryIcon,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  pending?: boolean;
  primaryIcon?: React.ReactNode;
}) {
  return (
    <div className="-mx-4 mt-1 flex flex-col gap-2 border-t px-4 pt-3">
      <Button type="button" className="h-11 w-full" onClick={onPrimary} disabled={pending}>
        {pending ? 'Setting things up…' : primaryLabel}
        {!pending && primaryIcon ? primaryIcon : null}
      </Button>
      {onSkip ? (
        <button
          type="button"
          onClick={onSkip}
          disabled={pending}
          className="h-10 text-sm font-semibold text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
        >
          {skipLabel ?? 'Skip for now'}
        </button>
      ) : null}
    </div>
  );
}
