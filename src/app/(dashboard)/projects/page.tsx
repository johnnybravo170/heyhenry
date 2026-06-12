import { Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ProjectsFilterBar } from '@/components/features/projects/projects-filter-bar';
import { ProjectsPager } from '@/components/features/projects/projects-pager';
import { ProjectsTable } from '@/components/features/projects/projects-table';
import { Button } from '@/components/ui/button';
import { listContacts } from '@/lib/db/queries/contacts';
import { listProjectProgress } from '@/lib/db/queries/cost-lines';
import {
  countProjects,
  countProjectsByLifecycleStage,
  listProjects,
  type ProjectListSort,
} from '@/lib/db/queries/projects';
import { type LifecycleStage, lifecycleStages } from '@/lib/validators/project';

export const metadata = {
  title: 'Projects — HeyHenry',
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 50;

/** Stages shown by default — paused / closed jobs are hidden until toggled on. */
const DEFAULT_STAGES: LifecycleStage[] = ['planning', 'awaiting_approval', 'active'];
const SORT_KEYS: ProjectListSort[] = ['name', 'customer', 'status', 'start', 'created'];

function parseStages(value: string | string[] | undefined): LifecycleStage[] {
  if (typeof value !== 'string') return DEFAULT_STAGES;
  const picked = value
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is LifecycleStage => (lifecycleStages as readonly string[]).includes(s));
  return picked.length > 0 ? picked : DEFAULT_STAGES;
}

function parseQuery(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseSort(value: string | string[] | undefined): ProjectListSort {
  return typeof value === 'string' && (SORT_KEYS as string[]).includes(value)
    ? (value as ProjectListSort)
    : 'created';
}

function parseDir(value: string | string[] | undefined): 'asc' | 'desc' {
  return value === 'asc' || value === 'desc' ? value : 'desc';
}

function parseOverBudget(value: string | string[] | undefined): boolean {
  return value === 'overbudget';
}

function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== 'string') return 1;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const resolved = await searchParams;
  const stages = parseStages(resolved.status);
  const query = parseQuery(resolved.q);
  const sort = parseSort(resolved.sort);
  const dir = parseDir(resolved.dir);
  const overBudget = parseOverBudget(resolved.attention);
  const page = parsePage(resolved.page);
  const hasFilters = Boolean(
    query || resolved.status || overBudget, // an explicit filter param counts
  );

  // Resolve customers matching the search term so we can match on
  // "project name OR customer name" in one paginated query.
  const contactIds = query
    ? (await listContacts({ search: query, limit: 100 })).map((c) => c.id)
    : [];

  const filters = {
    stages,
    name: query || undefined,
    contactIds,
    overBudget: overBudget || undefined,
    sort,
    dir,
  };

  const [projects, grandTotal, stageCounts, overBudgetCount, allCustomers] = await Promise.all([
    listProjects({ ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    countProjects(filters),
    countProjectsByLifecycleStage(),
    // Chip count is global (like the per-stage counts) — independent of the
    // status / search filters currently applied.
    countProjects({ overBudget: true }),
    // For the clone row-action's customer picker.
    listContacts({ limit: 500 }),
  ]);
  const customerOptions = allCustomers.map((c) => ({ id: c.id, name: c.name }));

  const progress = await listProjectProgress(projects.map((p) => p.id));
  const nowMs = Date.now();

  const rows = projects.map((p) => {
    const prog = progress.get(p.id);
    return {
      id: p.id,
      name: p.name,
      lifecycle_stage: p.lifecycle_stage as LifecycleStage,
      start_date: p.start_date,
      estimate_sent_at: p.estimate_sent_at,
      work_status_pct: prog?.workStatusPct ?? 0,
      over_budget: p.is_over_budget,
      customer: p.customer ? { id: p.customer.id, name: p.customer.name } : null,
      region: p.customer
        ? [p.customer.city, p.customer.province].filter(Boolean).join(' · ') || null
        : null,
    };
  });

  const directoryEmpty = !hasFilters && grandTotal === 0;
  const showingCount = rows.length;
  const rangeStart = grandTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + showingCount;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {directoryEmpty
              ? 'No projects yet.'
              : `${stageCounts.active} active · ${stageCounts.complete} complete`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/projects/import">
              <Sparkles className="size-3.5" />
              Import with Henry
            </Link>
          </Button>
          <Button variant="primary" asChild>
            <Link href="/projects/new">
              <Plus className="size-3.5" />
              New project
            </Link>
          </Button>
        </div>
      </header>

      {directoryEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card py-20 text-center">
          <p className="text-sm text-muted-foreground">
            Create your first renovation project to get started.
          </p>
          <Button variant="primary" asChild>
            <Link href="/projects/new">
              <Plus className="size-3.5" />
              New project
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <Suspense fallback={null}>
            <ProjectsFilterBar
              activeStages={stages}
              stageCounts={stageCounts}
              defaultQuery={query}
              overBudgetActive={overBudget}
              overBudgetCount={overBudgetCount}
            />
          </Suspense>

          {showingCount === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card py-16 text-center">
              <p className="text-sm font-medium">No projects match these filters.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/projects">Clear filters</Link>
              </Button>
            </div>
          ) : (
            <ProjectsTable
              projects={rows}
              sort={sort}
              dir={dir}
              nowMs={nowMs}
              customerOptions={customerOptions}
              footer={
                <ProjectsPager
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={grandTotal}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                />
              }
            />
          )}
        </>
      )}
    </div>
  );
}
