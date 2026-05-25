import { Sparkles } from 'lucide-react';
import { DocumentList } from '@/components/features/portal/document-list';
import { DocumentUpload } from '@/components/features/portal/document-upload';
import { PropertyRecordFlow } from '@/components/features/portal/property-record-flow';
import { TradeContactsList } from '@/components/features/portal/trade-contacts-list';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { formatDateTime } from '@/lib/date/format';
import {
  listDocumentsForProject,
  listSubAndVendorContactsForTenant,
  listSubcontractorsForProject,
} from '@/lib/db/queries/project-documents';
import { getPropertyRecordForProject } from '@/lib/db/queries/property-records';

export default async function DocumentsTabServer({ projectId }: { projectId: string }) {
  const [documents, propertyRecord, suppliers, projectSubs, tenant] = await Promise.all([
    listDocumentsForProject(projectId),
    getPropertyRecordForProject(projectId),
    listSubAndVendorContactsForTenant(),
    listSubcontractorsForProject(projectId),
    getCurrentTenant(),
  ]);
  const tz = tenant?.timezone ?? 'America/Vancouver';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Documents & warranties</h2>
        <p className="text-sm text-muted-foreground">
          Per-project file store — contracts, permits, warranties, manuals, inspections. Visible to
          the client unless you hide them, and rolled into the final Property Record.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
              <Sparkles className="size-4" aria-hidden />
            </div>
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-brand">
                Closeout · Property Record
              </p>
              <h3 className="text-base font-semibold">The permanent handoff package</h3>
              <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
                Phases, photos, selections, decisions, change orders, warranties — frozen and
                shareable. Regenerate anytime; the link stays the same.
              </p>
            </div>
          </div>
          {propertyRecord ? (
            <div className="text-right">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                Last generated
              </p>
              <p className="font-mono text-xs tabular-nums text-foreground">
                {formatDateTime(propertyRecord.generated_at, { timezone: tz })}
              </p>
            </div>
          ) : null}
        </div>

        <PropertyRecordFlow
          projectId={projectId}
          existingSlug={propertyRecord?.slug ?? null}
          hasPdf={Boolean(propertyRecord?.pdf_path)}
          hasZip={Boolean(propertyRecord?.zip_path)}
          emailedAt={propertyRecord?.emailed_at ?? null}
          emailedTo={propertyRecord?.emailed_to ?? null}
          defaultEmail={propertyRecord?.snapshot.customer.email ?? null}
          summary={propertyRecord?.henry_summary ?? propertyRecord?.snapshot.summary ?? null}
        />
      </div>

      <DocumentUpload projectId={projectId} suppliers={suppliers} />

      <DocumentList documents={documents} projectId={projectId} />

      {projectSubs.length > 0 ? (
        <TradeContactsList contacts={projectSubs} heading="Trade contacts on this project" />
      ) : null}
    </div>
  );
}
