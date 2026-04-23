import { cn } from '@/lib/utils';
import type { LifecycleStage } from '@/lib/validators/project';
import { lifecycleStageLabels } from '@/lib/validators/project';

// UI label is still "Status" everywhere the operator sees it — DB is the
// only layer that calls it a stage. See PROJECT_LIFECYCLE_PLAN.md.
const stageColors: Record<LifecycleStage, string> = {
  planning: 'bg-blue-100 text-blue-800',
  awaiting_approval: 'bg-amber-100 text-amber-800',
  active: 'bg-yellow-100 text-yellow-800',
  on_hold: 'bg-slate-100 text-slate-700',
  declined: 'bg-red-100 text-red-800',
  complete: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

export function ProjectStatusBadge({ stage }: { stage: LifecycleStage }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        stageColors[stage] ?? 'bg-gray-100 text-gray-800',
      )}
    >
      {lifecycleStageLabels[stage] ?? stage}
    </span>
  );
}
