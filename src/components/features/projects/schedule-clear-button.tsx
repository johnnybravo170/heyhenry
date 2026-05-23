'use client';

/**
 * "Clear & start over" for the operator's Schedule tab.
 *
 * Soft-deletes every active task on the project so the GC can re-
 * bootstrap from a different source. A shadcn AlertDialog (PATTERNS §3)
 * guards the destructive click; errors surface via toast (§5) instead of
 * a native alert(). Supports controlled-open / hideTrigger so the toolbar
 * ⋯ overflow can host it trigger-less.
 */

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
import { clearProjectScheduleAction } from '@/server/actions/project-schedule';

export function ScheduleClearButton({
  projectId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: {
  projectId: string;
  /** Controlled-open mode — drive from a parent (e.g. the ⋯ overflow). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleConfirm(event: React.MouseEvent) {
    event.preventDefault();
    startTransition(async () => {
      const res = await clearProjectScheduleAction(projectId);
      if (!res.ok) {
        toast.error(`Could not clear schedule: ${res.error}`);
        return;
      }
      // The action revalidates the route; the Gantt re-renders empty.
      controlledOnOpenChange?.(false);
    });
  }

  return (
    <AlertDialog open={controlledOpen} onOpenChange={controlledOnOpenChange}>
      {hideTrigger ? null : (
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Clear &amp; start over
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear the entire schedule?</AlertDialogTitle>
          <AlertDialogDescription>
            Every task is soft-deleted so you can re-bootstrap from a template, your budget, or a
            blank slate. Tasks stay recoverable in your records.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className="bg-destructive/10 text-destructive hover:bg-destructive/20"
          >
            {pending ? 'Clearing…' : 'Clear schedule'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
