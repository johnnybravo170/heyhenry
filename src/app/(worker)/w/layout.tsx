import type { ReactNode } from 'react';
import { WorkerBottomNav } from '@/components/features/worker/worker-bottom-nav';
import { requireWorker } from '@/lib/auth/helpers';
import { getOrCreateWorkerProfile } from '@/lib/db/queries/worker-profiles';

export const dynamic = 'force-dynamic';

export default async function WorkerLayout({ children }: { children: ReactNode }) {
  const { tenant } = await requireWorker();
  await getOrCreateWorkerProfile(tenant.id, tenant.member.id);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="border-b px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{tenant.name}</p>
      </header>
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">{children}</main>
      <WorkerBottomNav />
    </div>
  );
}
