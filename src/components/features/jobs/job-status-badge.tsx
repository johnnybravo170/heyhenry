import { StatusBadge } from '@/components/ui/status-badge';
import { jobStatusTone, statusToneIcon } from '@/lib/ui/status-tokens';
import { type JobStatus, jobStatusLabels } from '@/lib/validators/job';

/** Colour-coded pill for a job's lifecycle status. */
export function JobStatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  const tone = jobStatusTone[status];
  return (
    <StatusBadge
      tone={tone}
      label={jobStatusLabels[status]}
      icon={statusToneIcon[tone]}
      data-slot="job-status-badge"
      data-status={status}
      className={className}
    />
  );
}
