/**
 * Settings > Team page.
 *
 * Owner-only. Shows invite generation, active invites, and team member list.
 */

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { OwnerOnlyPane } from '@/components/features/settings/owner-only-pane';
import { InviteBookkeeperCard } from '@/components/features/team/invite-bookkeeper-card';
import { InviteWorkerCard } from '@/components/features/team/invite-worker-card';
import { InvitesTable } from '@/components/features/team/invites-table';
import { TeamMembersTable } from '@/components/features/team/team-members-table';
import { WorkerDefaultsCard } from '@/components/features/team/worker-defaults-card';
import { requireTenant } from '@/lib/auth/helpers';
import { getPrimaryOperatorName } from '@/lib/db/queries/profile';
import { listTeamMembers } from '@/lib/db/queries/team';
import { listInvitesByTenantId } from '@/lib/db/queries/worker-invites';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function TeamPage() {
  const { tenant } = await requireTenant();

  // Owner + admin manage the team; a member who deep-links here gets the
  // calm refusal pane instead of a redirect to /dashboard. (The nav hides
  // Team & workers for members — this is defense-in-depth.)
  if (tenant.member.role !== 'owner' && tenant.member.role !== 'admin') {
    const owner = await getPrimaryOperatorName(tenant.id);
    const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || null;
    return (
      <OwnerOnlyPane
        title="Team & workers"
        description={`Team membership, invites, and worker profiles for ${tenant.name} are managed by the owner and admins.`}
        ownerName={ownerName}
      />
    );
  }

  const admin = createAdminClient();
  const [membersResult, invites, tenantRow] = await Promise.all([
    listTeamMembers(tenant.id),
    listInvitesByTenantId(tenant.id),
    admin
      .from('tenants')
      .select(
        'workers_can_log_expenses, workers_can_invoice_default, workers_can_edit_old_entries, auto_assign_crew',
      )
      .eq('id', tenant.id)
      .single(),
  ]);
  const members = membersResult;
  const defaults = tenantRow.data;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">Invite workers and manage your team.</p>
      </div>

      <WorkerDefaultsCard
        workersCanLogExpenses={defaults?.workers_can_log_expenses ?? true}
        workersCanInvoiceDefault={defaults?.workers_can_invoice_default ?? false}
        workersCanEditOldEntries={defaults?.workers_can_edit_old_entries ?? false}
        autoAssignCrew={defaults?.auto_assign_crew ?? false}
      />

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Team Members</h2>
        <TeamMembersTable members={members} />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Invites</h2>
        <InviteWorkerCard />
        <InviteBookkeeperCard />
        <InvitesTable invites={invites} />
      </div>
    </div>
  );
}
