import { QboImportHistory } from '@/components/features/settings/qbo-import-history';
import { QboSubrouteHeader } from '@/components/features/settings/qbo-subroute-header';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { getQboConnectionSummary } from '@/lib/qbo/connection';
import { listImportHistoryAction } from '@/server/actions/qbo-import-rollback';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'QuickBooks import history — HeyHenry',
};

export default async function QboImportHistoryPage() {
  const [result, connection, tenant] = await Promise.all([
    listImportHistoryAction(),
    getQboConnectionSummary(),
    getCurrentTenant(),
  ]);
  const jobs = result.ok ? result.jobs : [];
  const timezone = tenant?.timezone ?? 'America/Vancouver';

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <QboSubrouteHeader
        title="Import history"
        description="Every import run lands here with its entity counts. A failed run surfaces its error so it's diagnosable. Roll back a job to undo every record it inserted."
        companyName={connection.companyName}
        realmId={connection.realmId}
        environment={connection.environment}
      />

      <QboImportHistory jobs={jobs} timezone={timezone} />
    </div>
  );
}
