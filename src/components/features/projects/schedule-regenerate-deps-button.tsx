'use client';

/**
 * "Auto-link dependencies" for the operator's Schedule tab.
 *
 * Wipes the project's existing project_schedule_dependencies rows and
 * rebuilds them via phase-aware bucketing — every task in phase N
 * depends on every task in the previous populated phase. Destructive of
 * any manual "Depends on" edits, so it's demoted into the toolbar ⋯
 * overflow behind a shadcn AlertDialog (PATTERNS §3); errors via toast
 * (§5). Also surfaced inline + non-destructively in the empty-deps case
 * via `variant="inline"` (no confirm — there are no edges to lose).
 *
 * Supports controlled-open / hideTrigger so the ⋯ overflow can host it.
 */

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { regenerateScheduleDependenciesAction } from '@/server/actions/project-schedule';

export function ScheduleRegenerateDepsButton({
  projectId,
  /** 'confirm' (default) gates behind the AlertDialog; 'inline' runs
   *  immediately — used in the empty-deps case where nothing is lost. */
  variant = 'confirm',
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: {
  projectId: string;
  variant?: 'confirm' | 'inline';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (onDone?: () => void) => {
    startTransition(async () => {
      const res = await regenerateScheduleDependenciesAction({ projectId });
      if (!res.ok) {
        toast.error(`Could not auto-link: ${res.error}`);
        return;
      }
      toast.success(
        res.edgesCreated > 0
          ? `Linked ${res.edgesCreated} ${res.edgesCreated === 1 ? 'dependency' : 'dependencies'}.`
          : 'No dependencies to link yet.',
      );
      router.refresh();
      onDone?.();
    });
  };

  // Non-destructive empty-deps affordance — link straight away, no confirm.
  if (variant === 'inline') {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => run()} disabled={pending}>
        {pending ? 'Linking…' : 'Link them automatically'}
      </Button>
    );
  }

  return (
    <AlertDialog open={controlledOpen} onOpenChange={controlledOnOpenChange}>
      {hideTrigger ? null : (
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Auto-link dependencies
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Auto-link to the canonical phase order?</AlertDialogTitle>
          <AlertDialogDescription>
            Every task is re-linked so each phase depends on the one before it (Demo → Framing →
            Rough-in → …). Any manual &ldquo;Depends on&rdquo; edits you&rsquo;ve made will be
            reset.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              run(() => controlledOnOpenChange?.(false));
            }}
            disabled={pending}
          >
            {pending ? 'Linking…' : 'Auto-link'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
