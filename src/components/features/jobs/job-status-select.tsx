'use client';

/**
 * Drop-in alternative to the board's drag-drop: a shadcn Select that fires
 * `changeJobStatusAction` on change. Used on the detail page and exercised
 * by the E2E suite (drag-drop is too fragile for headless tests).
 */

import { useState, useTransition } from 'react';
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
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type JobStatus, jobStatuses, jobStatusLabels } from '@/lib/validators/job';
import { changeJobStatusAction } from '@/server/actions/jobs';

export function JobStatusSelect({
  jobId,
  currentStatus,
  hasPhotos = true,
}: {
  jobId: string;
  currentStatus: JobStatus;
  hasPhotos?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  function applyStatus(next: string) {
    startTransition(async () => {
      const result = await changeJobStatusAction({ id: jobId, status: next });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Moved to ${jobStatusLabels[next as JobStatus]}`);
    });
  }

  function onChange(next: string) {
    if (next === currentStatus) return;

    // If completing without photos, confirm first
    if (next === 'complete' && !hasPhotos) {
      setPendingStatus(next);
      setConfirmOpen(true);
      return;
    }

    applyStatus(next);
  }

  function handleConfirmComplete() {
    if (pendingStatus) {
      applyStatus(pendingStatus);
    }
    setConfirmOpen(false);
    setPendingStatus(null);
  }

  function handleCancelComplete() {
    setConfirmOpen(false);
    setPendingStatus(null);
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Change status
        </span>
        <Select value={currentStatus} onValueChange={onChange} disabled={pending}>
          <SelectTrigger className="w-[180px]" aria-label="Change job status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {jobStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {jobStatusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete without photos?</AlertDialogTitle>
            <AlertDialogDescription>
              Before/after photos help with invoicing and social media posts. You can still add them
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelComplete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmComplete}>Complete anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
