import { RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { QboReviewQueueList } from '@/components/features/settings/qbo-review-queue';
import { QboSubrouteHeader } from '@/components/features/settings/qbo-subroute-header';
import { Button } from '@/components/ui/button';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { getQboConnectionSummary } from '@/lib/qbo/connection';
import { listReviewQueueAction } from '@/server/actions/qbo-review-queue';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'QuickBooks review queue — HeyHenry',
};

export default async function QboReviewPage() {
  const [result, connection, tenant] = await Promise.all([
    listReviewQueueAction(),
    getQboConnectionSummary(),
    getCurrentTenant(),
  ]);
  const jobs = result.ok ? result.jobs : [];
  const total = jobs.reduce((acc, j) => acc + j.queue.length, 0);
  const timezone = tenant?.timezone ?? 'America/Vancouver';

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <QboSubrouteHeader
        title="Review queue"
        description={
          total === 0
            ? 'No customers to review right now.'
            : `${total} customer${total === 1 ? '' : 's'} from QuickBooks fuzzy-matched an existing HeyHenry contact. Pick how each should land.`
        }
        companyName={connection.companyName}
        realmId={connection.realmId}
        environment={connection.environment}
      />

      <QboReviewQueueList jobs={jobs} timezone={timezone} />

      {total === 0 && jobs.length === 0 && (
        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="font-medium">Re-run the import to chain in dependents</p>
          <p className="mt-1 text-muted-foreground">
            Invoices, estimates, payments, and bills tied to customers you just resolved will land
            on the next import run.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/settings/quickbooks">
              <RefreshCcw className="size-3.5" />
              Back to import
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
