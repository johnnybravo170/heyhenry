'use client';

/**
 * QBO customer dedup review queue UI.
 *
 * Lists every ambiguous customer match the importer queued up. For
 * each entry, the user picks one of:
 *   - Merge with an HH candidate (binds qbo_customer_id to it)
 *   - Create a fresh customer (uses the QBO data on file)
 *   - Skip (drops from queue, no DB side-effects)
 *
 * Once the queue empties for a job, the page shows a nudge to re-run
 * the import — any invoices / estimates / payments / bills that got
 * skipped on the first pass will chain-import correctly now.
 */

import { Check, Loader2, Sparkles, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/date/format';
import type { ReviewQueueEntry } from '@/lib/qbo/import/job';
import { statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import { type ReviewJobSummary, resolveReviewEntryAction } from '@/server/actions/qbo-review-queue';

type Props = {
  jobs: ReviewJobSummary[];
  timezone: string;
};

export function QboReviewQueueList({ jobs, timezone }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  function resolve(
    job: ReviewJobSummary,
    entry: ReviewQueueEntry,
    kind: 'merge' | 'create' | 'skip',
    hhCustomerId?: string,
  ) {
    const key = `${job.id}:${entry.qbo_id}:${kind}:${hhCustomerId ?? ''}`;
    setActiveKey(key);
    startTransition(async () => {
      const action =
        kind === 'merge'
          ? { kind: 'merge' as const, hhCustomerId: hhCustomerId ?? '' }
          : kind === 'create'
            ? { kind: 'create' as const }
            : { kind: 'skip' as const };
      const result = await resolveReviewEntryAction({
        jobId: job.id,
        qboId: entry.qbo_id,
        action,
      });
      if (result.ok) {
        toast.success(
          kind === 'merge'
            ? 'Merged with existing customer.'
            : kind === 'create'
              ? 'Customer created from QBO data.'
              : 'Skipped.',
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setActiveKey(null);
    });
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No pending reviews</CardTitle>
          <CardDescription>
            Every QBO customer matched cleanly. If you re-run the import, this list will re-populate
            when the worker hits ambiguous matches again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              Import from{' '}
              <span className="text-muted-foreground">
                {formatDateTime(job.created_at, { timezone })}
              </span>
              <Badge variant="secondary" className={cn('font-medium', statusToneClass.warning)}>
                {job.queue.length} pending
              </Badge>
            </CardTitle>
            <CardDescription>
              Each row is a QBO customer that fuzzy-matched a HeyHenry contact. Pick whether to
              merge them or create a new record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.queue.map((entry) => (
              <div
                key={entry.qbo_id}
                className="space-y-3 rounded-lg border bg-muted/20 p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{entry.qbo_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.qbo_email || <span className="italic">no email</span>} ·{' '}
                    {entry.qbo_phone || <span className="italic">no phone</span>} · QBO id{' '}
                    <span className="font-mono">{entry.qbo_id}</span>
                  </p>
                </div>

                {entry.candidates.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Possible matches
                    </p>
                    {entry.candidates.map((cand) => {
                      const mergeKey = `${job.id}:${entry.qbo_id}:merge:${cand.hh_id}`;
                      return (
                        <div
                          key={cand.hh_id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{cand.name}</p>
                            <p className="flex flex-wrap items-center gap-1 truncate text-xs text-muted-foreground">
                              {cand.email || <span className="italic">no email</span>} ·{' '}
                              {cand.phone || <span className="italic">no phone</span>}
                              {/* ✦ Henry dedup match-confidence — a labelled
                                  judgement, operator still decides Merge/Create/Skip. */}
                              <span className="inline-flex items-center gap-1 font-medium text-brand">
                                <Sparkles className="size-3" aria-hidden="true" />
                                {cand.tier === 'name+city' ? 'name + city match' : 'name match'}
                              </span>
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => resolve(job, entry, 'merge', cand.hh_id)}
                            disabled={pending}
                          >
                            {activeKey === mergeKey ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Check className="size-3.5" />
                            )}
                            Merge into this
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
                    Heuristic flagged this as ambiguous but no candidate survived the safety check.
                    Create new is the safe default.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resolve(job, entry, 'create')}
                    disabled={pending}
                  >
                    {activeKey === `${job.id}:${entry.qbo_id}:create:` ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="size-3.5" />
                    )}
                    Create new
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => resolve(job, entry, 'skip')}
                    disabled={pending}
                  >
                    {activeKey === `${job.id}:${entry.qbo_id}:skip:` ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                    Skip
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
