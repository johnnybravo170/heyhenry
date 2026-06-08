import { Suspense } from 'react';
import { ProjectTabSelect } from '@/components/features/projects/project-tab-select';
import type { ProjectTabAlertCounts } from '@/lib/db/queries/project-tab-alerts';

/**
 * Soft-amber attention-count pill on a primary work-tab label (Budget,
 * Spend, Labour, Schedule, Billing). Streams in its own Suspense
 * boundary off the shared alerts promise, so the tab nav paints
 * synchronously and the count fills in once computed. Hides at 0.
 *
 * The Client tab keeps its own (rust) unread badge in the shell — this
 * is only for the per-tab alert counts of the primary work tabs.
 */
export function PrimaryTabAlertBadge({
  tabKey,
  alertsPromise,
}: {
  tabKey: keyof ProjectTabAlertCounts;
  alertsPromise: Promise<ProjectTabAlertCounts>;
}) {
  return (
    <Suspense fallback={null}>
      <BadgeInner tabKey={tabKey} alertsPromise={alertsPromise} />
    </Suspense>
  );
}

async function BadgeInner({
  tabKey,
  alertsPromise,
}: {
  tabKey: keyof ProjectTabAlertCounts;
  alertsPromise: Promise<ProjectTabAlertCounts>;
}) {
  const counts = await alertsPromise;
  const n = counts[tabKey] ?? 0;
  if (n <= 0) return null;
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      {n > 9 ? '9+' : n}
    </span>
  );
}

/**
 * Mobile counterpart: the nav collapses to a `<select>` below the `lg`
 * breakpoint, so the per-tab counts ride along inside it. Streams off the
 * shared alerts promise (fallback = the select with only the Client unread
 * count, which is already known synchronously). Merges the primary-tab
 * alert counts with the Client unread so the trigger total reflects every
 * badge the desktop row shows.
 */
export function ProjectTabSelectWithAlerts({
  projectId,
  currentTab,
  tabs,
  clientUnread,
  alertsPromise,
}: {
  projectId: string;
  currentTab: string;
  tabs: { key: string; label: string }[];
  clientUnread: number;
  alertsPromise: Promise<ProjectTabAlertCounts>;
}) {
  return (
    <Suspense
      fallback={
        <ProjectTabSelect
          projectId={projectId}
          currentTab={currentTab}
          tabs={tabs}
          counts={{ client: clientUnread }}
        />
      }
    >
      <SelectInner
        projectId={projectId}
        currentTab={currentTab}
        tabs={tabs}
        clientUnread={clientUnread}
        alertsPromise={alertsPromise}
      />
    </Suspense>
  );
}

async function SelectInner({
  projectId,
  currentTab,
  tabs,
  clientUnread,
  alertsPromise,
}: {
  projectId: string;
  currentTab: string;
  tabs: { key: string; label: string }[];
  clientUnread: number;
  alertsPromise: Promise<ProjectTabAlertCounts>;
}) {
  const alerts = await alertsPromise;
  return (
    <ProjectTabSelect
      projectId={projectId}
      currentTab={currentTab}
      tabs={tabs}
      counts={{ ...alerts, client: clientUnread }}
    />
  );
}
