/**
 * Settings > Team page.
 *
 * Owner + admin manage the crew (the page comment used to say "Owner-only" —
 * the guard is owner + admin; code wins). Two-region layout: Region A "Crew"
 * (roster + a single Add-to-crew action + folded pending invites) and Region B
 * "Crew defaults" (the quieter tenant-wide checkboxes).
 *
 * The owner-only Labour-margin read inside the worker editor is gated by
 * `isOwnerViewer`; rates themselves never reach worker/member/client surfaces.
 */

import { ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';
import { OwnerOnlyPane } from '@/components/features/settings/owner-only-pane';
import { AddToCrewDialog } from '@/components/features/team/add-to-crew-dialog';
import { HenryRosterSignals } from '@/components/features/team/henry-roster-signals';
import { PendingInvites } from '@/components/features/team/pending-invites';
import { TeamMembersTable } from '@/components/features/team/team-members-table';
import { WorkerDefaultsCard } from '@/components/features/team/worker-defaults-card';
import { Card, CardContent } from '@/components/ui/card';
import { requireTenant } from '@/lib/auth/helpers';
import { getPrimaryOperatorName } from '@/lib/db/queries/profile';
import { listTeamMembers } from '@/lib/db/queries/team';
import { listInvitesByTenantId } from '@/lib/db/queries/worker-invites';
import { listGcManagedWorkers } from '@/lib/db/queries/worker-profiles';
import { createAdminClient } from '@/lib/supabase/admin';

/** Humanize a member into a name for Henry's signal lines. */
function memberName(displayName: string | null, email: string): string {
  return displayName?.trim() || email.split('@')[0];
}

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

  const isOwnerViewer = tenant.member.role === 'owner';

  const admin = createAdminClient();
  const [members, gcWorkers, invites, tenantRow] = await Promise.all([
    listTeamMembers(tenant.id),
    listGcManagedWorkers(tenant.id),
    listInvitesByTenantId(tenant.id),
    admin
      .from('tenants')
      .select(
        'workers_can_log_expenses, workers_can_invoice_default, workers_can_edit_old_entries, auto_assign_crew',
      )
      .eq('id', tenant.id)
      .single(),
  ]);
  const defaults = tenantRow.data;

  const memberCount = members.length + gcWorkers.length;
  const onlyOwner = members.length === 1 && members[0]?.role === 'owner' && gcWorkers.length === 0;

  // ── Henry roster-gap signals (read-only) ──
  const signals: string[] = [];
  for (const m of members) {
    const wp = m.worker_profile;
    if (m.role !== 'worker' || !wp) continue;
    const name = memberName(wp.display_name, m.email);
    if (wp.worker_type === 'subcontractor' && !wp.gst_number) {
      signals.push(
        `${name} is set up as a subcontractor but has no GST # on file — year-end T5018 will need it.`,
      );
    }
    if (wp.default_hourly_rate_cents === null) {
      signals.push(`${name} has no pay rate yet — their time costs Labour at $0/hr.`);
    }
  }
  for (const w of gcWorkers) {
    const name = w.gc_managed_name ?? w.display_name ?? w.business_name ?? 'A worker';
    if (w.worker_type === 'subcontractor' && !w.gst_number) {
      signals.push(
        `${name} is set up as a subcontractor but has no GST # on file — year-end T5018 will need it.`,
      );
    }
    if (w.default_hourly_rate_cents === null) {
      signals.push(`${name} has no pay rate yet — their time costs Labour at $0/hr.`);
    }
  }
  const now = Date.now();
  const expiringSoon = invites.filter((inv) => {
    if (inv.used_at || inv.revoked_at) return false;
    const expires = new Date(inv.expires_at).getTime();
    const days = (expires - now) / (24 * 60 * 60 * 1000);
    return days > 0 && days <= 2;
  }).length;
  if (expiringSoon > 0) {
    signals.push(
      `${expiringSoon} invite${expiringSoon === 1 ? '' : 's'} expire${expiringSoon === 1 ? 's' : ''} in the next 2 days.`,
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <Link
          href="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Invite workers, admins, and your bookkeeper. Set what each can do.
        </p>
      </div>

      <HenryRosterSignals signals={signals} />

      {onlyOwner ? (
        // Empty state — owner alone. Never "0 of N seats."
        <Card>
          <CardContent className="flex flex-col items-center gap-3.5 px-8 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-paper text-foreground/80">
              <Users className="size-7" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Build your crew</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Invite the people you work with — your foreman, subs you trust, the bookkeeper who
                closes your year-end. They'll get a link to join.
              </p>
            </div>
            <AddToCrewDialog isOwnerViewer={isOwnerViewer} />
            <p className="text-xs text-muted-foreground">Just you for now.</p>
          </CardContent>
        </Card>
      ) : (
        // Region A — Crew
        <section
          aria-labelledby="region-crew"
          className="overflow-hidden rounded-xl border bg-card"
        >
          <header className="flex items-end justify-between gap-4 border-b px-4 py-4">
            <div className="min-w-0">
              <h2
                id="region-crew"
                className="flex items-baseline gap-2.5 text-base font-semibold text-foreground"
              >
                Crew
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {memberCount === 1 ? 'Just you' : `${memberCount} people`}
                </span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The people on {tenant.name} — owner, admins, workers, bookkeeper.
              </p>
            </div>
            <AddToCrewDialog isOwnerViewer={isOwnerViewer} />
          </header>

          <TeamMembersTable members={members} gcWorkers={gcWorkers} isOwnerViewer={isOwnerViewer} />

          <PendingInvites invites={invites} />
        </section>
      )}

      {/* Region B — Crew defaults (quieter half) */}
      <WorkerDefaultsCard
        workersCanLogExpenses={defaults?.workers_can_log_expenses ?? true}
        workersCanInvoiceDefault={defaults?.workers_can_invoice_default ?? false}
        workersCanEditOldEntries={defaults?.workers_can_edit_old_entries ?? false}
        autoAssignCrew={defaults?.auto_assign_crew ?? false}
      />

      <Link
        href="/settings/audit"
        className="inline-flex w-max items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        View invite &amp; member changes in the audit log
      </Link>
    </div>
  );
}
