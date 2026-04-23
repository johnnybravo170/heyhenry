import { BudgetSummaryCard } from '@/components/features/projects/budget-summary';
import { ProjectTimeline } from '@/components/features/projects/project-timeline';
import { getBudgetVsActual } from '@/lib/db/queries/project-buckets';
import { listProjectEvents } from '@/lib/db/queries/project-events';
import { getProject } from '@/lib/db/queries/projects';

export default async function OverviewTabServer({ projectId }: { projectId: string }) {
  const [project, budget, projectEvents] = await Promise.all([
    getProject(projectId),
    getBudgetVsActual(projectId),
    listProjectEvents(projectId),
  ]);
  if (!project) return null;

  return (
    <div className="space-y-6">
      <BudgetSummaryCard budget={budget} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Start Date</p>
          <p className="text-sm font-medium">
            {project.start_date
              ? new Date(project.start_date).toLocaleDateString('en-CA', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Not set'}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Target End</p>
          <p className="text-sm font-medium">
            {project.target_end_date
              ? new Date(project.target_end_date).toLocaleDateString('en-CA', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Not set'}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Mgmt Fee</p>
          <p className="text-sm font-medium">{Math.round(project.management_fee_rate * 100)}%</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Cost Buckets</p>
          <p className="text-sm font-medium">{project.cost_buckets.length}</p>
        </div>
      </div>

      <ProjectTimeline events={projectEvents} />
    </div>
  );
}
