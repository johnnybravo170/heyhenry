'use client';

/**
 * Horizontal phase rail — the homeowner-facing "you are here" milestone
 * tracker that sits above the portal updates feed. NOT a Gantt; pills are
 * equal width and date ranges only show on the active step.
 *
 * Used in two places:
 *   1. /portal/<slug> public page — read-only (no callbacks)
 *   2. Project detail Portal tab — operator advances/regresses
 */

import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ProjectPhase } from '@/lib/db/queries/project-phases';
import { cn } from '@/lib/utils';
import { advancePhaseAction, regressPhaseAction } from '@/server/actions/project-phases';

type PhaseRailProps = {
  phases: ProjectPhase[];
  /**
   * When provided, the rail renders advance / regress controls. Omit for
   * the public portal where homeowners only read.
   */
  projectId?: string;
};

export function PhaseRail({ phases, projectId }: PhaseRailProps) {
  const [isPending, startTransition] = useTransition();
  const editable = Boolean(projectId);

  function onAdvance() {
    if (!projectId) return;
    startTransition(async () => {
      const res = await advancePhaseAction(projectId);
      if (!res.ok) toast.error(res.error);
    });
  }
  function onRegress() {
    if (!projectId) return;
    startTransition(async () => {
      const res = await regressPhaseAction(projectId);
      if (!res.ok) toast.error(res.error);
    });
  }

  const currentIdx = phases.findIndex((p) => p.status === 'in_progress');
  const currentPhase = currentIdx >= 0 ? phases[currentIdx] : null;
  const allComplete = phases.length > 0 && phases.every((p) => p.status === 'complete');

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Project phase</h3>
          <p className="text-xs text-muted-foreground">
            {allComplete
              ? 'All phases complete.'
              : currentPhase
                ? `Currently in: ${currentPhase.name}`
                : 'Not started.'}
          </p>
        </div>
        {editable ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRegress}
              disabled={isPending}
              aria-label="Move to previous phase"
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onAdvance}
              disabled={isPending || allComplete}
              aria-label="Advance to next phase"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              Advance
            </Button>
          </div>
        ) : null}
      </div>

      {/* Pill rail. Horizontal scroll on narrow screens — long phase sets
          shouldn't wrap awkwardly. */}
      <ol
        className="mt-4 flex min-w-0 items-stretch gap-1 overflow-x-auto pb-1"
        aria-label="Project phases"
      >
        {phases.map((p) => {
          const isCurrent = p.status === 'in_progress';
          const isComplete = p.status === 'complete';
          return (
            <li
              key={p.id}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex min-w-[7rem] flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-center text-xs font-medium',
                isCurrent && 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30',
                isComplete &&
                  'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
                !isCurrent && !isComplete && 'border-muted bg-muted/40 text-muted-foreground',
              )}
            >
              {isComplete ? <Check className="size-3.5" aria-hidden /> : null}
              <span className="truncate">{p.name}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
