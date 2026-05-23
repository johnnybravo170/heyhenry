import { notFound } from 'next/navigation';
import { DeleteAccountCard } from '@/components/features/settings/delete-account-card';
import { OwnerOnlyPane } from '@/components/features/settings/owner-only-pane';
import { SettingsPageHeader } from '@/components/features/settings/settings-page-header';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { getPrimaryOperatorName } from '@/lib/db/queries/profile';

export const metadata = { title: 'Delete account — Settings' };

export default async function DeleteAccountSettingsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  // Owner-only — only the owner can destroy the workspace. Non-owners get
  // the shared calm refusal pane (the nav hides this destination for both
  // members and admins).
  if (tenant.member.role !== 'owner') {
    const owner = await getPrimaryOperatorName(tenant.id);
    const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || null;
    return (
      <OwnerOnlyPane
        title="Delete account"
        description={`Permanently deleting ${tenant.name} is reserved for the account owner.`}
        ownerName={ownerName}
      />
    );
  }

  return (
    <>
      <SettingsPageHeader
        title="Delete account"
        description="Permanently remove this workspace and everything in it. There's a 30-day reversibility window before anything is hard-deleted."
      />
      <DeleteAccountCard businessName={tenant.name} isOwner={true} />
    </>
  );
}
