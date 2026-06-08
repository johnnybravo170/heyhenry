// UI label is still "Status" everywhere the operator sees it — DB is the
// only layer that calls it a stage. See PROJECT_LIFECYCLE_PLAN.md.
import { StatusBadge } from '@/components/ui/status-badge';
import { projectStageTone } from '@/lib/ui/status-tokens';
import type { LifecycleStage } from '@/lib/validators/project';
import { lifecycleStageLabels } from '@/lib/validators/project';

export function ProjectStatusBadge({ stage }: { stage: LifecycleStage }) {
  const tone = projectStageTone[stage] ?? 'neutral';
  return <StatusBadge tone={tone} label={lifecycleStageLabels[stage] ?? stage} />;
}
