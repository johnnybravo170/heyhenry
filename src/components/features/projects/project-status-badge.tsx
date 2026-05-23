import { projectStageTone, statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import type { LifecycleStage } from '@/lib/validators/project';
import { lifecycleStageLabels } from '@/lib/validators/project';

// UI label is still "Status" everywhere the operator sees it — DB is the
// only layer that calls it a stage. See PROJECT_LIFECYCLE_PLAN.md.
//
// Text-only pill (no leading icon, no border) — matches the OD Paper status
// treatment used by CostStatusBadge. statusToneClass carries a `border-*`
// utility for legacy `<Badge variant="outline">` callers; we don't add the
// `border` utility here so no visible ring renders.
export function ProjectStatusBadge({ stage }: { stage: LifecycleStage }) {
  const tone = projectStageTone[stage] ?? 'neutral';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        statusToneClass[tone],
      )}
    >
      {lifecycleStageLabels[stage] ?? stage}
    </span>
  );
}
