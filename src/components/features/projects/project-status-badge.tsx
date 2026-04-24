import { projectStageTone, statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import type { LifecycleStage } from '@/lib/validators/project';
import { lifecycleStageLabels } from '@/lib/validators/project';

// UI label is still "Status" everywhere the operator sees it — DB is the
// only layer that calls it a stage. See PROJECT_LIFECYCLE_PLAN.md.
export function ProjectStatusBadge({ stage }: { stage: LifecycleStage }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        statusToneClass[projectStageTone[stage] ?? 'neutral'],
      )}
    >
      {lifecycleStageLabels[stage] ?? stage}
    </span>
  );
}
