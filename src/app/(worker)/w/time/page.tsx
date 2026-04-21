import { Plus } from 'lucide-react';
import Link from 'next/link';
import { WorkerTimeList } from '@/components/features/worker/worker-time-list';
import { Button } from '@/components/ui/button';
import { requireWorker } from '@/lib/auth/helpers';
import { getOrCreateWorkerProfile } from '@/lib/db/queries/worker-profiles';
import { listWorkerTimeEntries } from '@/lib/db/queries/worker-time';

export const dynamic = 'force-dynamic';

export default async function WorkerTimePage() {
  const { tenant } = await requireWorker();
  const profile = await getOrCreateWorkerProfile(tenant.id, tenant.member.id);
  const entries = await listWorkerTimeEntries(tenant.id, profile.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Time</h1>
        <Button asChild size="sm">
          <Link href="/w/time/new">
            <Plus className="size-4" /> Log time
          </Link>
        </Button>
      </div>
      <WorkerTimeList entries={entries} />
    </div>
  );
}
