'use client';

/**
 * QBO import history + rollback.
 *
 * Lists the last 20 imports for the tenant. Each row shows entity
 * counters, API-call usage, and a Roll back button when the batches
 * are still active. Rollback is destructive — guarded behind an
 * AlertDialog with an explicit confirm.
 */

import { History, Loader2, Undo2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/date/format';
import { qboRunStatusTone, statusToneClass, statusToneIcon } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import { cancelQboImportAction } from '@/server/actions/qbo-import';
import {
  type ImportHistoryEntry,
  rollbackImportJobAction,
} from '@/server/actions/qbo-import-rollback';

type Props = {
  jobs: ImportHistoryEntry[];
  timezone: string;
};

const ENTITY_LABEL: Record<string, string> = {
  Customer: 'customers',
  Vendor: 'vendors',
  Item: 'items',
  Invoice: 'invoices',
  Estimate: 'estimates',
  Payment: 'payments',
  Bill: 'bills',
  Purchase: 'receipts',
};

function importedSummary(entityCounters: ImportHistoryEntry['entity_counters']): string {
  const parts: string[] = [];
  for (const [entity, counters] of Object.entries(entityCounters)) {
    if (!counters || counters.imported === 0) continue;
    const label = ENTITY_LABEL[entity] ?? entity.toLowerCase();
    parts.push(`${counters.imported} ${label}`);
  }
  return parts.length === 0 ? 'nothing imported' : parts.join(' · ');
}

export function QboImportHistory({ jobs, timezone }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeJob, setActiveJob] = useState<string | null>(null);

  function rollback(jobId: string) {
    setActiveJob(jobId);
    startTransition(async () => {
      const result = await rollbackImportJobAction({ jobId });
      if (result.ok) {
        const total = Object.values(result.deleted).reduce((a, b) => a + b, 0);
        toast.success(
          total === 0
            ? 'Nothing left to roll back.'
            : `Rolled back ${total} record${total === 1 ? '' : 's'}.`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setActiveJob(null);
    });
  }

  function cancel(jobId: string) {
    setActiveJob(jobId);
    startTransition(async () => {
      const result = await cancelQboImportAction(jobId);
      if (result.ok) {
        toast.success('Import cancelled.');
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setActiveJob(null);
    });
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-5" />
            No imports yet
          </CardTitle>
          <CardDescription>
            Run an import from the <span className="font-mono">/settings/quickbooks</span> hub to
            populate history.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => {
        const isPending = pending && activeJob === job.id;
        const canRollback = job.active_batch_count > 0;
        const isInFlight = job.status === 'running' || job.status === 'queued';
        return (
          <Card key={job.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {formatDateTime(job.created_at, { timezone })}
                    {(() => {
                      const tone = qboRunStatusTone[job.status];
                      const Icon = statusToneIcon[tone];
                      return (
                        <Badge
                          variant="secondary"
                          className={cn('gap-1 font-medium capitalize', statusToneClass[tone])}
                        >
                          <Icon aria-hidden="true" className="size-3" />
                          {job.status}
                        </Badge>
                      );
                    })()}
                    {job.rolled_back && (
                      <Badge
                        variant="secondary"
                        className={cn('font-medium', statusToneClass.neutral)}
                      >
                        rolled back
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {importedSummary(job.entity_counters)} · {job.api_calls_used} API call
                    {job.api_calls_used === 1 ? '' : 's'}
                  </CardDescription>
                </div>
                {isInFlight && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancel(job.id)}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <XCircle className="size-3.5" />
                    )}
                    Cancel
                  </Button>
                )}
                {canRollback && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isPending}>
                        {isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Undo2 className="size-3.5" />
                        )}
                        Roll back
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Roll back this import?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Every record this import inserted will be deleted: customers, vendors,
                          items, invoices, estimates, payments, bills, and receipts tagged with this
                          job&rsquo;s import batches. Customers you manually edited will be gone too
                          if they came from this import. There is no automatic re-import.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => rollback(job.id)}
                          disabled={isPending}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isPending && <Loader2 className="size-3.5 animate-spin" />}
                          Yes, roll back
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {Object.entries(job.entity_counters)
                  .filter(([, counters]) => counters && counters.fetched > 0)
                  .map(([entity, counters]) => (
                    <div key={entity} className="rounded bg-muted/30 p-2">
                      <dt className="font-medium capitalize">{ENTITY_LABEL[entity] ?? entity}</dt>
                      <dd className="text-muted-foreground">
                        {counters.imported} imported
                        {counters.skipped > 0 ? (
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            {' '}
                            · {counters.skipped} skipped
                          </span>
                        ) : null}
                        {counters.failed > 0 ? (
                          <span className="font-semibold text-red-700 dark:text-red-400">
                            {' '}
                            · {counters.failed} failed
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ))}
              </dl>

              {/* Failed-pull rows from qbo_sync_log — a failed run is
                  diagnosable, not a dead end. */}
              {job.failed_syncs.length > 0 && (
                <div
                  className={cn(
                    'space-y-1.5 rounded-md border p-3 text-xs',
                    statusToneClass.danger,
                  )}
                >
                  <p className="flex items-center gap-1.5 font-semibold">
                    <statusToneIcon.danger aria-hidden="true" className="size-3.5" />
                    {job.failed_syncs.length} failed attempt
                    {job.failed_syncs.length === 1 ? '' : 's'}
                  </p>
                  {job.failed_syncs.map((f) => (
                    <p key={`${f.entity_type}:${f.error_message ?? ''}`} className="break-words">
                      <span className="font-medium capitalize">{f.entity_type}</span>
                      {f.error_message ? (
                        <span className="font-mono"> — {f.error_message}</span>
                      ) : null}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
