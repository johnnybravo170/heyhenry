import { DataExportCard } from '@/components/features/settings/data-export-card';
import { OwnerOnlyPane } from '@/components/features/settings/owner-only-pane';
import { SettingsPageHeader } from '@/components/features/settings/settings-page-header';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { getPrimaryOperatorName } from '@/lib/db/queries/profile';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Data export — Settings' };

export default async function DataExportSettingsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  // Owner-only: a full data archive is the owner's call. Non-owners get
  // the calm refusal pane (the nav already hides this for them).
  if (tenant.member.role !== 'owner') {
    const owner = await getPrimaryOperatorName(tenant.id);
    const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || null;
    return (
      <OwnerOnlyPane
        title="Data export"
        description={`A full archive of ${tenant.name}'s projects, customers, and invoices is exported by the account owner.`}
        ownerName={ownerName}
      />
    );
  }

  const supabase = await createClient();
  const { data: lastExport } = await supabase
    .from('data_exports')
    .select('download_url, created_at, status, expires_at')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isExpired = lastExport?.expires_at
    ? new Date(lastExport.expires_at as string) < new Date()
    : true;

  return (
    <>
      <SettingsPageHeader
        title="Data export"
        description="Generate a downloadable archive of your projects, customers, and invoices."
      />
      <DataExportCard
        lastExportUrl={!isExpired ? ((lastExport?.download_url as string) ?? null) : null}
        lastExportDate={lastExport?.created_at ? (lastExport.created_at as string) : null}
      />
    </>
  );
}
