import { Sparkles } from 'lucide-react';
import { DocumentList } from '@/components/features/portal/document-list';
import { DocumentUpload } from '@/components/features/portal/document-upload';
import { HomeRecordButton } from '@/components/features/portal/home-record-button';
import { HomeRecordEmailButton } from '@/components/features/portal/home-record-email-button';
import { TradeContactsList } from '@/components/features/portal/trade-contacts-list';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { formatDate, formatDateTime } from '@/lib/date/format';
import { getHomeRecordForProject } from '@/lib/db/queries/home-records';
import {
  listDocumentsForProject,
  listSubAndVendorContactsForTenant,
  listSubcontractorsForProject,
} from '@/lib/db/queries/project-documents';

export default async function DocumentsTabServer({ projectId }: { projectId: string }) {
  const [documents, homeRecord, suppliers, projectSubs, tenant] = await Promise.all([
    listDocumentsForProject(projectId),
    getHomeRecordForProject(projectId),
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
          the client unless you hide them, and rolled into the final Home Record.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="mb-1 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-brand">
              <Sparkles className="size-3" aria-hidden />
              Closeout
            </p>
            <h3 className="text-base font-semibold">Home Record</h3>
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
              The permanent handoff package — phases, photos, selections, decisions, COs, warranties
              — frozen and shareable. Regenerate anytime; the link stays the same.
            </p>
            {homeRecord ? (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Last generated {formatDateTime(homeRecord.generated_at, { timezone: tz })}
              </p>
            ) : null}
          </div>
          <HomeRecordButton
            projectId={projectId}
            existingSlug={homeRecord?.slug ?? null}
            hasPdf={Boolean(homeRecord?.pdf_path)}
            hasZip={Boolean(homeRecord?.zip_path)}
          />
        </div>

        {homeRecord ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <span>
              {homeRecord.emailed_at
                ? `Emailed to ${homeRecord.emailed_to ?? 'client'} on ${formatDate(
                    homeRecord.emailed_at,
                    { timezone: tz, style: 'long' },
                  )}`
                : 'Not yet emailed to the client.'}
            </span>
            <HomeRecordEmailButton
              projectId={projectId}
              defaultEmail={homeRecord.snapshot.customer.email ?? null}
              hasPdf={Boolean(homeRecord.pdf_path)}
              hasZip={Boolean(homeRecord.zip_path)}
              emailedAt={homeRecord.emailed_at}
              emailedTo={homeRecord.emailed_to}
            />
          </div>
        ) : null}
      </div>

      <DocumentUpload projectId={projectId} suppliers={suppliers} />

      <DocumentList documents={documents} projectId={projectId} />

      {projectSubs.length > 0 ? (
        <TradeContactsList contacts={projectSubs} heading="Trade contacts on this project" />
      ) : null}
    </div>
  );
}
