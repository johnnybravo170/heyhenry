import { QboClassMapping } from '@/components/features/settings/qbo-class-mapping';
import { QboSubrouteHeader } from '@/components/features/settings/qbo-subroute-header';
import { getQboConnectionSummary } from '@/lib/qbo/connection';
import { listClassMappingsAction } from '@/server/actions/qbo-class-mapping';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'QuickBooks Class mapping — HeyHenry',
};

export default async function QboClassMappingPage() {
  const [result, connection] = await Promise.all([
    listClassMappingsAction(),
    getQboConnectionSummary(),
  ]);
  const classes = result.ok ? result.classes : [];
  const projects = result.ok ? result.projects : [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <QboSubrouteHeader
        title="Map QuickBooks Classes to projects"
        description="QuickBooks Class is the standard job-cost tag. Point each one at the HeyHenry project it belongs to — bills and receipts get tagged in bulk so spend rolls up under the right job."
        companyName={connection.companyName}
        realmId={connection.realmId}
        environment={connection.environment}
      />

      <QboClassMapping classes={classes} projects={projects} />
    </div>
  );
}
