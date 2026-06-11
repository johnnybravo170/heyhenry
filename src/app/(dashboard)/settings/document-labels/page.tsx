import { Type } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { DocumentLabelsForm } from '@/components/features/settings/document-labels-form';
import { SettingsPageHeader } from '@/components/features/settings/settings-page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentTenant } from '@/lib/auth/helpers';
import {
  buildLabelMap,
  DOCUMENT_LABEL_SLOTS,
  type DocumentLabelSlot,
  listTenantMemory,
  resolveDocumentLabel,
} from '@/lib/db/queries/tenant-memory';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Document labels — Settings' };

export default async function DocumentLabelsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/login?next=/settings/document-labels');
  if (!['owner', 'admin'].includes(tenant.member.role)) notFound();

  const rows = await listTenantMemory(tenant.id, 'label.');
  const labelMap = buildLabelMap(rows);

  const currentLabels = Object.fromEntries(
    (Object.keys(DOCUMENT_LABEL_SLOTS) as DocumentLabelSlot[]).map((slot) => [
      slot,
      resolveDocumentLabel(slot, labelMap),
    ]),
  ) as Record<DocumentLabelSlot, string>;

  return (
    <>
      <SettingsPageHeader
        title="Document labels"
        description="Rename the total line on customer-facing estimates and invoices."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Type className="size-5" />
              <div>
                <CardTitle>Total line label</CardTitle>
                <CardDescription>
                  What customers see on the grand-total row of your estimates and invoices. Only
                  this line changes — the operator dashboard always shows &ldquo;Total&rdquo;.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DocumentLabelsForm currentLabels={currentLabels} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
