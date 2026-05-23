'use client';

/**
 * Offline time-entry queue — the "saved, will sync" surface on /w/time.
 *
 * Field reality: the worker logs hours where there's no signal. New entries
 * land in IndexedDB (see `time-queue.ts`) with an explicit offline state so a
 * field entry is never silently dropped. This component shows:
 *   - a durable "saved on this phone — will sync" banner while items wait
 *   - per-item rows (waiting / syncing / failed) with the project + hours
 *   - flush on the browser `online` event + a manual "Sync now" / pull-to-retry
 *
 * Replays through the same `logWorkerTimeAction` the online path uses; on
 * success the item leaves the queue and the history refreshes. Within-tab
 * only (no Service-Worker background sync) — see `time-queue.ts` scope note.
 */

import { CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import { formatDate } from '@/lib/date/format';
import {
  listQueuedTime,
  type QueuedTimeEntry,
  removeQueuedTime,
  updateQueuedTime,
} from '@/lib/storage/time-queue';
import { cn } from '@/lib/utils';
import { logWorkerTimeAction } from '@/server/actions/worker-time';

export function WorkerTimeQueue() {
  const router = useRouter();
  const tz = useTenantTimezone();
  const [queue, setQueue] = useState<QueuedTimeEntry[]>([]);
  const [online, setOnline] = useState(true);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(async () => {
    setQueue(await listQueuedTime());
  }, []);

  const flush = useCallback(async () => {
    if (flushing) return;
    const pending = await listQueuedTime();
    if (pending.length === 0) return;
    setFlushing(true);
    let synced = 0;
    for (const item of pending) {
      await updateQueuedTime(item.id, { status: 'syncing' });
      setQueue(await listQueuedTime());
      try {
        const res = await logWorkerTimeAction({
          project_id: item.project_id,
          budget_category_id: item.budget_category_id || undefined,
          cost_line_id: item.cost_line_id || undefined,
          hours: item.hours,
          notes: item.notes || undefined,
          entry_date: item.entry_date,
          // These were already confirmed at capture time on the device.
          confirm_empty: true,
        });
        if (res.ok) {
          await removeQueuedTime(item.id);
          synced += 1;
        } else {
          await updateQueuedTime(item.id, { status: 'failed', error: res.error });
        }
      } catch {
        await updateQueuedTime(item.id, { status: 'failed', error: 'No connection' });
      }
      setQueue(await listQueuedTime());
    }
    setFlushing(false);
    if (synced > 0) router.refresh();
  }, [flushing, router]);

  useEffect(() => {
    void refresh();
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);

    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // Try once on mount in case we came back while the tab was backgrounded.
    if (typeof navigator !== 'undefined' && navigator.onLine) void flush();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh, flush]);

  if (queue.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3 rounded-[14px] border border-amber-400 bg-card p-3.5 shadow-[0_8px_24px_rgba(10,10,10,0.10)]">
        <span className="grid size-10 shrink-0 place-items-center rounded-[11px] border border-amber-300/70 bg-amber-100 text-amber-700">
          <CloudOff className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[14px] text-foreground">Saved on this phone — will sync.</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug">
            {queue.length} item{queue.length === 1 ? '' : 's'} waiting for signal. Nothing is lost —
            they&rsquo;ll send when you&rsquo;re back online.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={flushing || !online}
          onClick={() => void flush()}
        >
          {flushing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Sync now
        </Button>
      </div>

      <div className="flex items-center gap-2 px-0.5 font-mono font-bold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
        <span>Queued</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-foreground">{queue.length}</span>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card">
        {queue.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 border-border border-b p-3.5 last:border-b-0"
          >
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                item.status === 'failed' ? 'bg-destructive' : 'bg-amber-500',
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[14px] text-foreground">
                {item.project_name} · <span className="tabular-nums">{item.hours.toFixed(2)}h</span>
              </p>
              <p className="mt-0.5 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
                {formatDate(`${item.entry_date}T00:00`, { timezone: tz, style: 'medium' })}
                {item.category_name ? ` · ${item.category_name}` : ''}
              </p>
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono font-bold text-[11px] uppercase tracking-wide',
                item.status === 'failed'
                  ? 'border border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border border-amber-300/40 bg-amber-100 text-amber-800',
              )}
            >
              {item.status === 'syncing' ? (
                <>
                  <Loader2 className="size-[11px] animate-spin" /> Syncing
                </>
              ) : item.status === 'failed' ? (
                <>
                  <CloudOff className="size-[11px]" /> Retry
                </>
              ) : (
                <>
                  <CloudOff className="size-[11px]" /> Will sync
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
