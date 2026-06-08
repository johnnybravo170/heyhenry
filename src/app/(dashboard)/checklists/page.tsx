import { ChevronRight, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { TeamChecklist } from '@/components/features/checklist/team-checklist';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';
import { requireTenant } from '@/lib/auth/helpers';
import { listOpenChecklistRollup } from '@/lib/db/queries/project-checklist';

export const dynamic = 'force-dynamic';

export default async function ChecklistsPage() {
  const { tenant } = await requireTenant();
  const projects = await listOpenChecklistRollup(tenant.id);
  const totalOpen = projects.reduce((acc, p) => acc + p.open_count, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {/* "CREW LIST" eyebrow — explicit distinction from Tasks + Todos */}
        <Eyebrow className="text-brand">Crew list</Eyebrow>
        <h1 className="text-2xl font-bold tracking-tight">Team checklists</h1>
        <p className="text-sm text-muted-foreground">
          What the crew needs on each site — informally. Anyone on a project can add or check items.
        </p>
        <p className="text-xs text-muted-foreground">
          Not your <strong className="text-foreground">Tasks</strong> (the schedule) or{' '}
          <strong className="text-foreground">Todos</strong> (private) — this is the running list
          the whole crew adds to on each site.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <ListChecks className="size-8 text-muted-foreground" />
            <p className="text-sm font-semibold">Nothing open</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              When the crew adds something on a site, it&rsquo;ll show up here grouped by project.
            </p>
            <Link
              href="/projects"
              className="mt-2 inline-flex items-center rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
            >
              Open a project
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tally — mono numbers for scannability */}
          <p className="text-sm text-muted-foreground">
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {totalOpen}
            </span>{' '}
            open across{' '}
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {projects.length}
            </span>{' '}
            {projects.length === 1 ? 'project' : 'projects'}.
          </p>

          {projects.map((p, i) => (
            <Card key={p.project_id}>
              <CardHeader className="border-b pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base font-bold">
                      <Link href={`/projects/${p.project_id}`} className="hover:underline">
                        {p.project_name}
                      </Link>
                    </CardTitle>
                    {p.customer_name ? (
                      <p className="truncate text-xs text-muted-foreground">{p.customer_name}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* Rust emphasis chip for the busiest project (index 0), muted for others */}
                    <span
                      className={
                        i === 0
                          ? 'rounded-full bg-brand/10 px-2.5 py-1 font-mono text-eyebrow font-bold uppercase tracking-[0.06em] text-brand tabular-nums'
                          : 'rounded-full bg-muted px-2.5 py-1 font-mono text-eyebrow font-bold uppercase tracking-[0.06em] text-muted-foreground tabular-nums'
                      }
                    >
                      {p.open_count} open
                    </span>
                    <Link
                      href={`/projects/${p.project_id}`}
                      aria-label={`Open ${p.project_name}`}
                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ChevronRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <TeamChecklist projectId={p.project_id} chrome="bare" />
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
