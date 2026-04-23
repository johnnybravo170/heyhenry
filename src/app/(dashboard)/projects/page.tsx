import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { AwaitingApprovalList } from '@/components/features/projects/awaiting-approval-list';
import { CloneProjectDialog } from '@/components/features/projects/clone-project-dialog';
import { ProjectNameEditor } from '@/components/features/projects/project-name-editor';
import { ProjectStatusBadge } from '@/components/features/projects/project-status-badge';
import { ProjectTabs } from '@/components/features/projects/project-tabs';
import { Button } from '@/components/ui/button';
import { getProjectsAwaitingApproval } from '@/lib/db/queries/awaiting-approval';
import { listCustomers } from '@/lib/db/queries/customers';
import { countProjectsByLifecycleStage, listProjects } from '@/lib/db/queries/projects';
import type { LifecycleStage } from '@/lib/validators/project';

export const metadata = {
  title: 'Projects — HeyHenry',
};

type ViewKey = 'all' | 'awaiting_approval' | 'active' | 'complete';

type RawSearchParams = Record<string, string | string[] | undefined>;

function parseView(value: string | string[] | undefined): ViewKey {
  if (value === 'active' || value === 'complete' || value === 'awaiting_approval') return value;
  return 'all';
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const resolved = await searchParams;
  const view = parseView(resolved.view);

  const [projects, counts, awaitingApproval, allCustomers] = await Promise.all([
    listProjects({ limit: 200 }),
    countProjectsByLifecycleStage(),
    // Always fetch — we need the count for the tab label even on other tabs.
    getProjectsAwaitingApproval(),
    listCustomers({ limit: 500 }),
  ]);
  const customerOptions = allCustomers.map((c) => ({ id: c.id, name: c.name }));
  // "All" excludes on_hold by default so paused jobs don't clutter the list.
  // Dedicated filter can surface them later if JVD asks.
  const total =
    counts.planning +
    counts.awaiting_approval +
    counts.active +
    counts.declined +
    counts.complete +
    counts.cancelled;
  const active = counts.active;

  // Active tab = estimate-approved work actually happening. Planning and
  // awaiting_approval have their own surfaces; on_hold / declined / cancelled
  // are excluded.
  const filtered =
    view === 'active'
      ? projects.filter((p) => p.lifecycle_stage === 'active')
      : view === 'complete'
        ? projects.filter((p) => p.lifecycle_stage === 'complete')
        : projects.filter((p) => p.lifecycle_stage !== 'on_hold');

  const tabCounts = {
    all: total,
    awaiting_approval: awaitingApproval.length,
    active,
    complete: counts.complete,
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {total === 0 ? 'No projects yet.' : `${active} active · ${counts.complete} complete`}
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="size-3.5" />
            New project
          </Link>
        </Button>
      </header>

      {total > 0 && (
        <Suspense fallback={null}>
          <ProjectTabs counts={tabCounts} />
        </Suspense>
      )}

      {view === 'awaiting_approval' ? (
        <AwaitingApprovalList projects={awaitingApproval} variant="full" />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-muted-foreground">
            Create your first renovation project to get started.
          </p>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-1 size-3.5" />
              New project
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Project</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Start</th>
                <th className="px-4 py-3 text-right font-medium">Complete</th>
                <th className="w-px px-2 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="group border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <ProjectNameEditor projectId={p.id} name={p.name} variant="inline" />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.customer ? (
                      <Link href={`/customers/${p.customer.id}`} className="hover:underline">
                        {p.customer.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ProjectStatusBadge stage={p.lifecycle_stage as LifecycleStage} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.start_date
                      ? new Date(p.start_date).toLocaleDateString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{p.percent_complete}%</td>
                  <td className="px-2 py-3 text-right">
                    <CloneProjectDialog
                      projectId={p.id}
                      projectName={p.name}
                      defaultCustomerId={p.customer?.id ?? null}
                      customers={customerOptions}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
