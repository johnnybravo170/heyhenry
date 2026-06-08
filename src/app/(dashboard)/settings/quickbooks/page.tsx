import { FolderTree, History, Users } from 'lucide-react';
import Link from 'next/link';
import { QuickBooksConnectCard } from '@/components/features/settings/quickbooks-connect-card';
import { QuickBooksImportLauncher } from '@/components/features/settings/quickbooks-import-launcher';
import { SettingsPageHeader } from '@/components/features/settings/settings-page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { formatDate } from '@/lib/date/format';
import { createClient } from '@/lib/supabase/server';
import { qboRunStatusTone, statusToneClass, statusToneIcon } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import { listClassMappingsAction } from '@/server/actions/qbo-class-mapping';
import { listImportHistoryAction } from '@/server/actions/qbo-import-rollback';
import { listReviewQueueAction } from '@/server/actions/qbo-review-queue';

export const metadata = { title: 'QuickBooks — Settings' };
export const dynamic = 'force-dynamic';

export default async function QuickBooksSettingsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('tenants')
    .select(
      'qbo_realm_id, qbo_company_name, qbo_connected_at, qbo_disconnected_at, qbo_environment, qbo_last_full_sync_at',
    )
    .eq('id', tenant.id)
    .single();

  const connected = !!data?.qbo_realm_id && !!data?.qbo_connected_at;

  // Fan out the three sub-route list actions for live counts when connected.
  // Cheap — each is a single tenant-scoped read; the hub server component
  // owns the aggregation so the cards aren't static links any more.
  const [history, review, classes] = connected
    ? await Promise.all([
        listImportHistoryAction(),
        listReviewQueueAction(),
        listClassMappingsAction(),
      ])
    : [null, null, null];

  const lastRun = history?.ok ? (history.jobs[0] ?? null) : null;
  const lastRunFailed = lastRun?.status === 'failed';
  const reviewCount = review?.ok ? review.jobs.reduce((acc, j) => acc + j.queue.length, 0) : 0;
  const unmappedCount = classes?.ok
    ? classes.classes.filter((c) => !c.current_project_id).length
    : 0;

  return (
    <>
      <SettingsPageHeader
        title="QuickBooks"
        description="QuickBooks is your system of record. HeyHenry reads from it — import your customers, invoices, payments, and costs."
      />
      <div className="space-y-4">
        {/* The #1 boundary — stated plainly. Import-only today; push is unbuilt. */}
        <p className="rounded-lg border border-l-[3px] border-l-foreground bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <strong className="font-semibold text-foreground">
            QuickBooks is the system of record; HeyHenry is import-only today.
          </strong>{' '}
          Every byte flows QuickBooks → HeyHenry. Pushing invoices &amp; costs out is coming.
          Nothing here writes back to your QuickBooks file.
        </p>

        <QuickBooksConnectCard
          realmId={(data?.qbo_realm_id as string) ?? null}
          companyName={(data?.qbo_company_name as string) ?? null}
          connectedAt={(data?.qbo_connected_at as string) ?? null}
          disconnectedAt={(data?.qbo_disconnected_at as string) ?? null}
          environment={(data?.qbo_environment as 'sandbox' | 'production') ?? null}
          lastImportAt={(data?.qbo_last_full_sync_at as string) ?? null}
          timezone={tenant.timezone}
          reviewCount={reviewCount}
          lastRunFailed={lastRunFailed}
        />

        {connected ? (
          <>
            <QuickBooksImportLauncher />

            <div className="grid gap-3 sm:grid-cols-3">
              <SubRouteCard
                href="/settings/qbo-review"
                icon={Users}
                title="Review queue"
                value={
                  reviewCount > 0
                    ? `${reviewCount} customer${reviewCount === 1 ? '' : 's'} need review`
                    : 'All matched cleanly'
                }
                isCalm={reviewCount === 0}
                badge={
                  reviewCount > 0 ? (
                    <Badge
                      variant="secondary"
                      className={cn('gap-1 font-medium', statusToneClass.warning)}
                    >
                      <statusToneIcon.warning aria-hidden="true" className="size-3" />
                      {reviewCount}
                    </Badge>
                  ) : null
                }
              />
              <SubRouteCard
                href="/settings/qbo-class-mapping"
                icon={FolderTree}
                title="Class mapping"
                value={
                  unmappedCount > 0
                    ? `${unmappedCount} class${unmappedCount === 1 ? '' : 'es'} unmapped`
                    : 'Every class mapped'
                }
                isCalm={unmappedCount === 0}
                badge={
                  unmappedCount > 0 ? (
                    <Badge
                      variant="secondary"
                      className={cn('gap-1 font-medium', statusToneClass.warning)}
                    >
                      <statusToneIcon.warning aria-hidden="true" className="size-3" />
                      {unmappedCount}
                    </Badge>
                  ) : null
                }
              />
              <SubRouteCard
                href="/settings/qbo-history"
                icon={History}
                title="Import history"
                value={
                  lastRun
                    ? `Last run ${formatDate(lastRun.created_at, { timezone: tenant.timezone })}`
                    : 'No imports yet'
                }
                isCalm={!lastRun}
                badge={
                  lastRun
                    ? (() => {
                        const tone = qboRunStatusTone[lastRun.status];
                        const Icon = statusToneIcon[tone];
                        return (
                          <Badge
                            variant="secondary"
                            className={cn('gap-1 font-medium capitalize', statusToneClass[tone])}
                          >
                            <Icon aria-hidden="true" className="size-3" />
                            {lastRun.status}
                          </Badge>
                        );
                      })()
                    : null
                }
              />
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

function SubRouteCard({
  href,
  icon: Icon,
  title,
  value,
  isCalm,
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  isCalm: boolean;
  badge: React.ReactNode;
}) {
  return (
    <Link href={href} className="block">
      <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:bg-muted/50">
        <div className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="size-4 text-muted-foreground" />
            {title}
          </span>
          {badge}
        </div>
        <p className={cn('text-sm', isCalm ? 'text-muted-foreground' : 'font-medium')}>{value}</p>
      </Card>
    </Link>
  );
}
