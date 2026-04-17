import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { BoardViewToggle } from '@/components/features/jobs/board-view-toggle';
import { JobCalendar } from '@/components/features/jobs/job-calendar';
import { Button } from '@/components/ui/button';
import { getJobsForMonth } from '@/lib/db/queries/calendar';

export const metadata = {
  title: 'Calendar — HeyHenry',
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function parseYear(value: string | string[] | undefined): number {
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    if (!Number.isNaN(n) && n >= 2020 && n <= 2100) return n;
  }
  return new Date().getFullYear();
}

function parseMonth(value: string | string[] | undefined): number {
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 12) return n;
  }
  return new Date().getMonth() + 1;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const resolved = await searchParams;
  const year = parseYear(resolved.year);
  const month = parseMonth(resolved.month);

  const jobs = await getJobsForMonth(year, month);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {jobs.length === 0
              ? 'No jobs scheduled this month.'
              : `${jobs.length} job${jobs.length === 1 ? '' : 's'} this month`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <BoardViewToggle />
          </Suspense>
          <Button asChild>
            <Link href="/jobs/new">
              <Plus className="size-3.5" />
              New job
            </Link>
          </Button>
        </div>
      </header>

      <JobCalendar jobs={jobs} initialYear={year} initialMonth={month - 1} />
    </div>
  );
}
