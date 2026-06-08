import { StatusBadge } from '@/components/ui/status-badge';
import { taskStatusClass, taskStatusIcon } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import { type TaskStatus, taskStatusLabels, taskStatusShortLabels } from '@/lib/validators/task';

/**
 * One-word status pill for task states. The richer task palette
 * (orange/purple/teal in addition to the shared tones) lives in
 * `taskStatusClass` in status-tokens.ts; that class string overrides
 * the neutral base tone via className so no extra branch is needed.
 *
 * `hideLabelOnMobile` keeps the icon alone on small viewports while
 * the full label sits in `title` for hover/a11y.
 */
export function TaskStatusBadge({
  status,
  className,
  hideLabelOnMobile = false,
}: {
  status: TaskStatus;
  className?: string;
  /** Hide the status label below the `sm` breakpoint, leaving just the icon. */
  hideLabelOnMobile?: boolean;
}) {
  const Icon = taskStatusIcon[status];
  const fullLabel = taskStatusLabels[status];
  const shortLabel = taskStatusShortLabels[status];
  return (
    // tone=neutral is overridden by taskStatusClass[status] via className merge.
    <StatusBadge
      tone="neutral"
      icon={Icon ?? undefined}
      data-slot="task-status-badge"
      data-status={status}
      title={fullLabel}
      className={cn(taskStatusClass[status], className)}
    >
      <span className={hideLabelOnMobile ? 'hidden sm:inline' : undefined}>{shortLabel}</span>
    </StatusBadge>
  );
}
