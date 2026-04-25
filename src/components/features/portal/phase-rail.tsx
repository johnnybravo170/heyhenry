'use client';

/**
 * Horizontal phase rail — the homeowner-facing "you are here" milestone
 * tracker that sits above the portal updates feed. NOT a Gantt; pills are
 * equal width and date ranges only show on the active step.
 *
 * Tap a pill to expand its phase panel below: shows the phase status +
 * any photos pinned to that phase via the operator's PhotoPortalButton.
 *
 * Used in two places:
 *   1. /portal/<slug> public page — read-only (no callbacks)
 *   2. Project detail Portal tab — operator advances/regresses
 */

import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { ProjectPhase } from '@/lib/db/queries/project-phases';
import { cn } from '@/lib/utils';
import { advancePhaseAction, regressPhaseAction } from '@/server/actions/project-phases';

export type PhaseRailPhoto = {
  id: string;
  phase_id: string;
  url: string;
  caption: string | null;
};

type PhaseRailProps = {
  phases: ProjectPhase[];
  /**
   * When provided, the rail renders advance / regress controls. Omit for
   * the public portal where homeowners only read.
   */
  projectId?: string;
  /**
   * Phase-pinned photos. Empty omits the expand-on-tap behaviour. The
   * pill is still labelled with status; clicking just no-ops.
   */
  phasePhotos?: PhaseRailPhoto[];
};

export function PhaseRail({ phases, projectId, phasePhotos = [] }: PhaseRailProps) {
  const [isPending, startTransition] = useTransition();
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);
  const [openPhotoUrl, setOpenPhotoUrl] = useState<string | null>(null);
  const editable = Boolean(projectId);

  // Bucket photos by phase for fast lookup.
  const photosByPhase = new Map<string, PhaseRailPhoto[]>();
  for (const photo of phasePhotos) {
    const list = photosByPhase.get(photo.phase_id) ?? [];
    list.push(photo);
    photosByPhase.set(photo.phase_id, list);
  }

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
          const photos = photosByPhase.get(p.id) ?? [];
          const isExpanded = expandedPhaseId === p.id;
          const expandable = photos.length > 0;
          return (
            <li
              key={p.id}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex min-w-[7rem] flex-1 flex-col items-stretch overflow-hidden rounded-md border text-center text-xs font-medium',
                isCurrent && 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30',
                isComplete &&
                  'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
                !isCurrent && !isComplete && 'border-muted bg-muted/40 text-muted-foreground',
              )}
            >
              <button
                type="button"
                onClick={() => setExpandedPhaseId(isExpanded ? null : expandable ? p.id : null)}
                disabled={!expandable}
                className={cn(
                  'flex w-full items-center justify-center gap-1.5 px-3 py-2',
                  expandable && 'cursor-pointer hover:bg-black/[0.03]',
                  !expandable && 'cursor-default',
                )}
                aria-expanded={expandable ? isExpanded : undefined}
              >
                {isComplete ? <Check className="size-3.5" aria-hidden /> : null}
                <span className="truncate">{p.name}</span>
                {expandable ? (
                  <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-black/10 text-[10px] tabular-nums">
                    {photos.length}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      {expandedPhaseId ? (
        <div className="mt-3 rounded-md border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-medium">
            Photos from {phases.find((p) => p.id === expandedPhaseId)?.name}
          </p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
            {(photosByPhase.get(expandedPhaseId) ?? []).map((photo) => (
              <button
                key={photo.id}
                type="button"
                className="block aspect-square overflow-hidden rounded-md border bg-background"
                onClick={() => setOpenPhotoUrl(photo.url)}
                aria-label={photo.caption ?? 'Open photo'}
              >
                {/* biome-ignore lint/performance/noImgElement: signed URLs */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? ''}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={!!openPhotoUrl} onOpenChange={(o) => !o && setOpenPhotoUrl(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {openPhotoUrl ? (
            // biome-ignore lint/performance/noImgElement: signed URLs
            <img
              src={openPhotoUrl}
              alt=""
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
