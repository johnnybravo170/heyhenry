/**
 * Project Overview tab — split into per-section async components so each
 * piece streams independently. The variance card is by far the heaviest
 * (variance + CO contributions) and used to block the entire tab; now the
 * facts grid + timeline can paint while it's still loading.
 *
 * Skeletons are lightweight on purpose — see TabSkeleton for the rationale.
 */

import { Suspense } from 'react';
import { VarianceTab } from '@/components/features/projects/budget-summary';
import { HenryInsightStrip } from '@/components/features/projects/henry-insight-strip';
import { ProjectTimeline } from '@/components/features/projects/project-timeline';
import { getProjectChangeOrderContributions } from '@/lib/db/queries/change-orders';
import { getVarianceReport } from '@/lib/db/queries/cost-lines';
import { listProjectEvents } from '@/lib/db/queries/project-events';
import { getProject } from '@/lib/db/queries/projects';

export default function OverviewTabServer({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      {/* "Needs You" attention strip — getProjectInsights ranks the project's
          do-this items (margin at risk, unsent changes, overdue draws,
          over-budget sections, client messages, unpaid bills), capped ~4 +
          "+N more". Collapses to a calm on-track line when clean. */}
      <Suspense fallback={<InsightStripSkeleton />}>
        <HenryInsightStrip projectId={projectId} />
      </Suspense>

      <Suspense fallback={<VarianceSkeleton />}>
        <VarianceSection projectId={projectId} />
      </Suspense>

      {/* The editable project facts (name / customer / dates / billing /
          mgmt fee / status) moved to the Project Details card (the `▾` in
          the header), so Overview is freed to be a cockpit. */}

      <Suspense fallback={<TimelineSkeleton />}>
        <TimelineSection projectId={projectId} />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

async function VarianceSection({ projectId }: { projectId: string }) {
  const [project, variance, coContributions] = await Promise.all([
    getProject(projectId),
    getVarianceReport(projectId),
    getProjectChangeOrderContributions(projectId),
  ]);
  if (!project) return null;
  return (
    <VarianceTab
      variance={variance}
      lifecycleStage={project.lifecycle_stage}
      projectId={projectId}
      appliedChangeOrders={coContributions.appliedOrder}
      allChangeOrders={coContributions.all}
      fromTab={{ tab: 'overview', label: 'Overview' }}
    />
  );
}

async function TimelineSection({ projectId }: { projectId: string }) {
  const projectEvents = await listProjectEvents(projectId);
  return <ProjectTimeline events={projectEvents} />;
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function VarianceSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-12 rounded-md bg-muted/60" />
      <div className="h-40 rounded-md bg-muted/60" />
      <div className="h-32 rounded-md bg-muted/60" />
    </div>
  );
}

function InsightStripSkeleton() {
  return (
    <div className="animate-pulse space-y-1.5">
      <div className="h-4 w-40 rounded bg-muted/60" />
      <div className="h-11 rounded-lg bg-muted/60" />
      <div className="h-11 rounded-lg bg-muted/60" />
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-6 w-32 rounded bg-muted/60" />
      <div className="h-24 rounded-md bg-muted/60" />
    </div>
  );
}
