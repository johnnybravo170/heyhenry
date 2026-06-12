import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { BoardViewToggle } from '@/components/features/jobs/board-view-toggle';
import { JobEmptyState } from '@/components/features/jobs/job-empty-state';
import { JobListFilters } from '@/components/features/jobs/job-list-filters';
import { JobListTable } from '@/components/features/jobs/job-list-table';
import { Button } from '@/components/ui/button';
import { listContacts } from '@/lib/db/queries/contacts';
import { countJobsByStatus, listJobs } from '@/lib/db/queries/jobs';
import { type JobStatus, jobStatuses } from '@/lib/validators/job';

type RawSearchParams = Record<string, string | string[] | undefined>;

function parseStatus(value: string | string[] | undefined): JobStatus | null {
  if (typeof value !== 'string') return null;
  return (jobStatuses as readonly string[]).includes(value) ? (value as JobStatus) : null;
}

function parseContactId(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null;
  // Lightweight UUID v4 guard. `listJobs` still validates via Supabase.
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export const metadata = {
  title: 'Job list — HeyHenry',
};

export default async function JobListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const status = parseStatus(resolvedSearchParams.status);
  const contactId = parseContactId(resolvedSearchParams.contact_id);
  const hasFilters = Boolean(status || contactId);

  const [jobs, counts, customers] = await Promise.all([
    listJobs({
      status: status ?? undefined,
      contact_id: contactId ?? undefined,
      limit: 200,
    }),
    countJobsByStatus(),
    listContacts({ limit: 500 }),
  ]);

  const grandTotal = counts.booked + counts.in_progress + counts.complete + counts.cancelled;
  const showingCount = jobs.length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {grandTotal === 0
              ? 'Nothing scheduled yet.'
              : hasFilters
                ? `${showingCount} shown of ${grandTotal} job${grandTotal === 1 ? '' : 's'}`
                : `${grandTotal} job${grandTotal === 1 ? '' : 's'} total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <BoardViewToggle />
          </Suspense>
          <Button variant="primary" asChild>
            <Link href="/jobs/new">
              <Plus className="size-3.5" />
              New job
            </Link>
          </Button>
        </div>
      </header>

      {grandTotal > 0 ? (
        <Suspense fallback={null}>
          <JobListFilters contacts={customers.map((c) => ({ id: c.id, name: c.name }))} />
        </Suspense>
      ) : null}

      {showingCount === 0 ? (
        <JobEmptyState variant={grandTotal === 0 ? 'fresh' : 'filtered'} />
      ) : (
        <JobListTable jobs={jobs} />
      )}
    </div>
  );
}
