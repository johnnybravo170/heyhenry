import { ListChecks } from 'lucide-react';
import Link from 'next/link';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { listOpenChecklistRollup } from '@/lib/db/queries/project-checklist';

/**
 * Compact rollup pill for the GC dashboard. Hidden when the team checklist
 * is empty across all projects so we don't add noise to the dashboard.
 */
export async function ChecklistDashboardChip() {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  const projects = await listOpenChecklistRollup(tenant.id);
  if (projects.length === 0) return null;

  const total = projects.reduce((acc, p) => acc + p.open_count, 0);

  return (
    <Link
      href="/checklists"
      className="inline-flex items-center gap-2 self-start rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted"
    >
      <ListChecks className="size-4 shrink-0 text-muted-foreground" />
      <span className="font-medium">Team checklist</span>
      <span className="text-muted-foreground">
        <span className="font-mono font-semibold tabular-nums text-foreground">{total}</span> open
        across{' '}
        <span className="font-mono font-semibold tabular-nums text-foreground">
          {projects.length}
        </span>{' '}
        {projects.length === 1 ? 'project' : 'projects'}
      </span>
      {/* Rust dot — signals live items needing attention */}
      <span aria-hidden="true" className="ml-auto size-2 shrink-0 rounded-full bg-brand" />
    </Link>
  );
}
