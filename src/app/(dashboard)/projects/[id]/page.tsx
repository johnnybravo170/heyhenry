import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CrewRoster } from '@/components/features/projects/crew-roster';
import {
  PrimaryTabAlertBadge,
  ProjectTabSelectWithAlerts,
} from '@/components/features/projects/primary-tab-alert-badge';
import { ProjectActionsMenu } from '@/components/features/projects/project-actions-menu';
import { ProjectDetailsCard } from '@/components/features/projects/project-details-card';
import { ProjectIntakeZone } from '@/components/features/projects/project-intake-zone';
import { ProjectNameEditor } from '@/components/features/projects/project-name-editor';
import { ProjectStatusBadge } from '@/components/features/projects/project-status-badge';
import { ScopeDiffReview } from '@/components/features/projects/scope-diff-review';
import { StagedEmailsBanner } from '@/components/features/projects/staged-emails-banner';
import BudgetTabServer from '@/components/features/projects/tabs/budget-tab-server';
import ClientHubTabServer, {
  type ClientSubtab,
} from '@/components/features/projects/tabs/client-hub-tab-server';
import CostsTabServer from '@/components/features/projects/tabs/costs-tab-server';
import DocumentsTabServer from '@/components/features/projects/tabs/documents-tab-server';
import GalleryTabServer from '@/components/features/projects/tabs/gallery-tab-server';
import InvoicesTabServer from '@/components/features/projects/tabs/invoices-tab-server';
import MemosTabServer from '@/components/features/projects/tabs/memos-tab-server';
import OverviewTabServer from '@/components/features/projects/tabs/overview-tab-server';
import ScheduleTabServer from '@/components/features/projects/tabs/schedule-tab-server';
import { TabSkeleton } from '@/components/features/projects/tabs/tab-skeleton';
import TimeTabServer from '@/components/features/projects/tabs/time-tab-server';
import { UnsentChangesChip } from '@/components/features/projects/unsent-changes-chip';
import { VersionsDropdown } from '@/components/features/projects/versions-dropdown';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { listCustomers } from '@/lib/db/queries/customers';
import { listAssignmentsForProject } from '@/lib/db/queries/project-assignments';
import { listBudgetCategoriesForProject } from '@/lib/db/queries/project-budget-categories';
import { getProjectTabAlerts } from '@/lib/db/queries/project-tab-alerts';
import { getProject } from '@/lib/db/queries/projects';
import { listWorkerProfiles } from '@/lib/db/queries/worker-profiles';
import type { LifecycleStage } from '@/lib/validators/project';

// Audio transcription of voice memos can take up to ~30s — bump the
// server-action timeout past Vercel's 10s Hobby default.
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project ? `${project.name} — HeyHenry` : 'Project — HeyHenry' };
}

type Tab =
  | 'overview'
  | 'budget'
  | 'estimate'
  | 'costs'
  | 'variance'
  | 'invoices'
  | 'time'
  | 'memos'
  | 'gallery'
  | 'change-orders'
  | 'portal'
  | 'schedule'
  | 'selections'
  | 'documents'
  | 'messages'
  | 'client';

/**
 * Project detail shell. Renders the header + tab nav synchronously, then
 * defers each tab's data fetching to its own `<Suspense>`-wrapped server
 * component. Compared to the previous single-page-loads-everything design,
 * this:
 *
 *   - cuts the shell's DB round-trips from ~30 to ~3
 *   - fetches per-tab data only when that tab is active
 *   - streams tab content in, so the header renders in <100ms regardless of
 *     which tab is open
 *
 * Each tab component lives in `src/components/features/projects/tabs/`.
 * They share `getProject` and a few other queries via `React.cache()`, so
 * multiple tabs calling the same query in the same render dedupe.
 */
export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  // Tab aliases — old separate Estimate / Change Orders tabs fold into
  // Budget under the unified-Budget design (decision 6790ef2b). Old
  // ?tab=buckets bookmarks also remap. Anything else passes through.
  const rawTab = resolvedSearchParams.tab;
  // Messages / Selections / Portal fold into the unified Client hub. Old
  // ?tab=messages bookmarks remap to the hub with the matching subtab.
  const clientSubtab: ClientSubtab =
    (resolvedSearchParams.client as ClientSubtab | undefined) ??
    (rawTab === 'selections' ? 'selections' : rawTab === 'portal' ? 'portal' : 'messages');
  const explicitTab =
    rawTab === 'buckets' || rawTab === 'estimate' || rawTab === 'change-orders'
      ? 'budget'
      : rawTab === 'messages' || rawTab === 'selections' || rawTab === 'portal'
        ? 'client'
        : (rawTab as Tab | undefined);

  // Default-expanded behaviour for the unified Budget tab. Defaulted
  // by lifecycle stage (planning/awaiting_approval → expanded; active+
  // → collapsed) with `?expand=all` / `?expand=none` URL override.
  // Legacy `?mode=editing` / `?mode=executing` still honored as an
  // alias for muscle memory.
  const rawExpand = resolvedSearchParams.expand;
  const rawMode = resolvedSearchParams.mode;
  const explicitExpand =
    rawExpand === 'all' || rawMode === 'editing'
      ? true
      : rawExpand === 'none' || rawMode === 'executing'
        ? false
        : null;

  // Crew roster (in the Project Details card) is owner/admin only — the
  // underlying assignment actions assert the role, so we also gate the
  // fetch + render. `tenant.id` equals the project's tenant under RLS.
  const tenant = await getCurrentTenant();
  const canManageCrew =
    !!tenant && (tenant.member.role === 'owner' || tenant.member.role === 'admin');
  const tenantId = tenant?.id;

  // Shell-only queries. getProject is React.cache-wrapped, so generateMetadata
  // + the shell + any inner tab that also calls it (e.g. OverviewTab) dedupe
  // to a single DB hit per request.
  const [
    project,
    projectCategories,
    customerList,
    crewWorkers,
    crewAssignments,
    unreadMessagesRes,
    unreadIdeasRes,
  ] = await Promise.all([
    getProject(id),
    listBudgetCategoriesForProject(id),
    // Customer options for the ⋯ overflow's Duplicate dialog (clone needs a
    // target customer, defaulting to this project's customer).
    listCustomers({ limit: 500 }),
    canManageCrew && tenantId ? listWorkerProfiles(tenantId) : Promise.resolve([]),
    canManageCrew && tenantId ? listAssignmentsForProject(tenantId, id) : Promise.resolve([]),
    // Unread inbound messages count for the Messages tab badge. Cheap
    // query thanks to idx_pm_tenant_unread_inbound. Failure is non-fatal
    // (we just hide the badge).
    (async () => {
      const supabase = await import('@/lib/supabase/server').then((m) => m.createClient());
      const c = await supabase;
      return c
        .from('project_messages')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', id)
        .eq('direction', 'inbound')
        .is('read_by_operator_at', null);
    })(),
    // Unread customer-idea-board items for the Selections tab badge.
    // Cheap thanks to idx_pibi_tenant_unread. Failure is non-fatal.
    (async () => {
      const supabase = await import('@/lib/supabase/server').then((m) => m.createClient());
      const c = await supabase;
      return c
        .from('project_idea_board_items')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', id)
        .is('read_by_operator_at', null);
    })(),
  ]);
  if (!project) notFound();
  const unreadMessages = unreadMessagesRes.count ?? 0;
  const unreadIdeas = unreadIdeasRes.count ?? 0;
  const customerOptions = customerList.map((c) => ({ id: c.id, name: c.name }));

  // Per-tab attention counts for the nav badges. Kicked off here (not
  // awaited) so it runs in parallel with the rest of the render and
  // streams into each primary-tab label via its own Suspense boundary —
  // it never blocks the synchronous header paint. Derives from the shared
  // getProjectInsights set (request-deduped via React cache()), so these
  // badges, the Overview "Needs You" strip total, and the mobile <select>
  // per-option counts can't drift. The tenant is resolved inside the
  // insight engine, so no tenantId arg is threaded through here.
  const tabAlertsPromise = getProjectTabAlerts(id);

  // Crew roster (owner/admin only) — the project-level roster lives in the
  // Project Details card now. `scheduled_date IS NULL` = ongoing crew; dated
  // assignments are the (deferred) scheduling surface, excluded here.
  const crewSlot = canManageCrew ? (
    <CrewRoster
      projectId={id}
      workers={crewWorkers.map((w) => ({
        profile_id: w.id,
        display_name: w.display_name ?? 'Worker',
        worker_type: w.worker_type,
        default_hourly_rate_cents: w.default_hourly_rate_cents,
        default_charge_rate_cents: w.default_charge_rate_cents,
      }))}
      assignments={crewAssignments
        .filter((a) => a.scheduled_date === null)
        .map((a) => ({
          id: a.id,
          worker_profile_id: a.worker_profile_id,
          hourly_rate_cents: a.hourly_rate_cents,
          charge_rate_cents: a.charge_rate_cents,
          notes: a.notes,
        }))}
    />
  ) : undefined;

  // Stage-aware default tab when the operator hits /projects/[id] without a
  // ?tab=... query. Planning lands on Budget (the work to do); active and
  // beyond land on Overview (the running status). Explicit ?tab=... wins.
  const stage = project.lifecycle_stage as LifecycleStage;
  const defaultTab: Tab =
    stage === 'planning' || stage === 'awaiting_approval' ? 'budget' : 'overview';
  const tab: Tab = explicitTab ?? defaultTab;

  // Pre-approval projects (planning / awaiting_approval) default to
  // expanded so the operator sees the full scope at a glance while
  // authoring. Active+ defaults collapsed (status-tracking posture).
  const budgetExpanded = explicitExpand ?? (stage === 'planning' || stage === 'awaiting_approval');

  // One unified nav (no separate header-actions pill row). Primary tabs
  // are the run-the-job work; the secondary group (Client / Photos /
  // Documents / Notes) sits in a lighter tier in the same bar. Estimate +
  // Change Orders fold into Budget; Messages / Selections / Portal fold
  // into the Client hub — all kept as route aliases above. Renames are
  // label-only (route keys unchanged): Time→Labour, Customer Billing→Billing,
  // Gallery→Photos.
  // (Notes stays in the secondary group until the Overview-attention-strip
  // card folds the internal Notes feed into the Overview timeline.)
  const primaryTabs: { key: Tab; label: string }[] = [
    { key: 'budget', label: 'Budget' },
    { key: 'costs', label: 'Spend' },
    { key: 'time', label: 'Labour' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'invoices', label: 'Billing' },
    { key: 'overview', label: 'Overview' },
  ];
  // Client is the documented exception to the unified issue-TYPE badge
  // model: its badge stays an unread ITEM-count (messages + customer ideas),
  // because unread badges are conventionally item counts and converting it
  // would regress the UX. The Overview strip still represents the same thing
  // as ONE `client_message` row, and getProjectTabAlerts excludes the
  // `client` owning tab — so the work-tab badges + strip stay congruent
  // while Client unread remains its own affordance.
  const secondaryTabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'client', label: 'Client', badge: unreadMessages + unreadIdeas },
    { key: 'gallery', label: 'Photos' },
    { key: 'documents', label: 'Documents' },
    { key: 'memos', label: 'Notes' },
  ];
  const allTabs = [...primaryTabs, ...secondaryTabs];

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header — lean identity chrome only (orient + navigate). No
          metrics: % complete lives on Overview, draws on Billing. The `▾`
          opens the Project Details card (attributes); the `⋯` is the
          actions overflow. */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          {/* Identity row: name + ▾ details + status badge. */}
          <div className="flex flex-wrap items-center gap-2">
            <ProjectNameEditor projectId={project.id} name={project.name} />
            <ProjectDetailsCard
              projectId={project.id}
              name={project.name}
              customer={
                project.customer ? { id: project.customer.id, name: project.customer.name } : null
              }
              description={project.description}
              startDate={project.start_date}
              targetEndDate={project.target_end_date}
              isCostPlus={project.is_cost_plus}
              managementFeeRate={project.management_fee_rate}
              lifecycleStage={project.lifecycle_stage as LifecycleStage}
              crewSlot={crewSlot}
            />
            <ProjectStatusBadge stage={project.lifecycle_stage as LifecycleStage} />
          </div>
          {/* Customer — quiet, secondary, linked identity (the "Mohan job"
              + a one-tap path to the homeowner from any tab). */}
          {project.customer ? (
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href={`/contacts/${project.customer.id}`} className="hover:underline">
                {project.customer.name}
              </Link>
            </p>
          ) : null}
        </div>
        {/* Actions row — capture + utility only. Destination pills now live
            in the single unified nav below (no separate header pill row). */}
        <div className="flex flex-wrap items-center gap-1">
          <ProjectIntakeZone
            projectId={project.id}
            appearance="ghost"
            categories={projectCategories.map((b) => ({
              id: b.id,
              name: b.name,
              section: b.section_row?.name ?? '',
            }))}
          />
          <Suspense fallback={null}>
            <VersionsDropdown projectId={id} />
          </Suspense>
          <ProjectActionsMenu
            projectId={project.id}
            projectName={project.name}
            defaultCustomerId={project.customer?.id ?? null}
            customers={customerOptions}
          />
        </div>
      </header>

      {/* Unsent changes chip — surfaces when working state has diverged
          from the latest signed snapshot. Hidden on legacy / planning
          projects (no snapshot). Streams in its own Suspense so it
          never blocks the tab nav. */}
      <Suspense fallback={null}>
        <UnsentChangesChip projectId={id} />
      </Suspense>

      {/* Diff review modal — opens when ?review=diff is in the URL. */}
      <Suspense fallback={null}>
        <ScopeDiffReview projectId={id} />
      </Suspense>

      {/* Forwarded emails staged on this project, awaiting confirmation. */}
      <Suspense fallback={null}>
        <StagedEmailsBanner projectId={id} />
      </Suspense>

      {/* Tab navigation: <select> dropdown on narrow screens, full row above
          the lg breakpoint. */}
      <div className="mb-6 lg:hidden">
        <ProjectTabSelectWithAlerts
          projectId={id}
          currentTab={tab}
          tabs={allTabs.map((t) => ({ key: t.key, label: t.label }))}
          clientUnread={unreadMessages + unreadIdeas}
          alertsPromise={tabAlertsPromise}
        />
      </div>
      <div className="mb-6 hidden flex-wrap items-center gap-1 border-b lg:flex">
        {primaryTabs.map((t) => (
          <Link
            key={t.key}
            href={`/projects/${id}?tab=${t.key}`}
            // Default Next.js behaviour: prefetch on hover for app-router
            // pages. Cuts perceived tab-switch latency since the data is
            // warm by the time the operator clicks.
            prefetch
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground'
            }`}
          >
            {t.label}
            {/* Overview is the aggregator ("Needs You" strip), not an alert
                owner — every other primary tab carries its per-tab count. */}
            {t.key === 'budget' ||
            t.key === 'costs' ||
            t.key === 'time' ||
            t.key === 'schedule' ||
            t.key === 'invoices' ? (
              <PrimaryTabAlertBadge tabKey={t.key} alertsPromise={tabAlertsPromise} />
            ) : null}
          </Link>
        ))}
        {/* Secondary group — lighter tier in the same bar (Client / Photos /
            Documents / Notes). Client carries the unread badge (messages +
            customer ideas). */}
        <span className="mx-1 h-4 w-px self-center bg-border" aria-hidden="true" />
        {secondaryTabs.map((t) => (
          <Link
            key={t.key}
            href={`/projects/${id}?tab=${t.key}`}
            prefetch={false}
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t.key
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground'
            }`}
          >
            {t.label}
            {t.badge && t.badge > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {t.badge > 9 ? '9+' : t.badge}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {/* Tab content — each tab streams independently. */}
      <Suspense key={tab} fallback={<TabSkeleton />}>
        {tab === 'overview' ? <OverviewTabServer projectId={id} /> : null}
        {tab === 'budget' ? (
          <BudgetTabServer projectId={id} defaultExpanded={budgetExpanded} />
        ) : null}
        {tab === 'costs' ? <CostsTabServer projectId={id} /> : null}
        {/* Variance merged into Overview — keep route alive for old bookmarks
            but render Overview content. Drop entirely in a future cleanup. */}
        {tab === 'variance' ? <OverviewTabServer projectId={id} /> : null}
        {tab === 'invoices' ? <InvoicesTabServer projectId={id} /> : null}
        {tab === 'time' ? <TimeTabServer projectId={id} /> : null}
        {tab === 'schedule' ? <ScheduleTabServer projectId={id} /> : null}
        {tab === 'memos' ? <MemosTabServer projectId={id} /> : null}
        {tab === 'gallery' ? <GalleryTabServer projectId={id} /> : null}
        {tab === 'documents' ? <DocumentsTabServer projectId={id} /> : null}
        {/* Client hub — Messages / Selections / Portal & Updates grouped
            behind one tab, switched by ?client=<subtab>. */}
        {tab === 'client' ? (
          <ClientHubTabServer
            projectId={id}
            subtab={clientSubtab}
            unreadMessages={unreadMessages}
            unreadIdeas={unreadIdeas}
          />
        ) : null}
      </Suspense>
    </div>
  );
}
