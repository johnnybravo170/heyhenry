import { Badge } from '@/components/ui/badge';
import { jobStatusTone, statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import { type JobStatus, jobStatusLabels } from '@/lib/validators/job';

/**
 * Colour-coded pill for a job's lifecycle status. Paired with the kanban
 * column headers so the status reads the same in both places.
 */
export function JobStatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return (
    <Badge
      data-slot="job-status-badge"
      data-status={status}
      variant="outline"
      className={cn('font-medium border', statusToneClass[jobStatusTone[status]], className)}
    >
      {jobStatusLabels[status]}
    </Badge>
  );
}
