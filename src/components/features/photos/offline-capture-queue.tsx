'use client';

/**
 * Offline capture queue — the field-reality surface for the Photos tab.
 *
 * When the device is offline, captures from PhotoUpload are persisted to
 * IndexedDB instead of uploaded. This component shows:
 *   - an offline banner ("you're offline, N waiting")
 *   - per-item status rows (waiting / syncing / failed) with a thumbnail
 *   - a bulk "Retry all" / "Sync now" action
 *
 * Flush wiring: we listen for the browser `online` event and auto-flush, and
 * expose a manual flush button. Uploads replay through the same
 * `uploadPhotoAction` the online path uses. On success the item leaves the
 * queue and the gallery refreshes; on failure it stays as `failed` for retry.
 *
 * This is a within-tab queue (no Service Worker background sync) — see
 * capture-queue.ts for the scope note.
 */

import { CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import { formatDateTime } from '@/lib/date/format';
import {
  listCaptures,
  type QueuedCapture,
  removeCapture,
  updateCapture,
} from '@/lib/storage/capture-queue';
import { cn } from '@/lib/utils';
import { photoTagLabels } from '@/lib/validators/photo';
import { uploadPhotoAction } from '@/server/actions/photos';

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function OfflineCaptureQueue({ projectId }: { projectId: string }) {
  const router = useRouter();
  const tz = useTenantTimezone();
  const [queue, setQueue] = useState<QueuedCapture[]>([]);
  const [online, setOnline] = useState(true);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(async () => {
    setQueue(await listCaptures(projectId));
  }, [projectId]);

  const flush = useCallback(async () => {
    if (flushing) return;
    const pending = await listCaptures(projectId);
    if (pending.length === 0) return;
    setFlushing(true);
    let synced = 0;
    for (const item of pending) {
      await updateCapture(item.id, { status: 'syncing' });
      setQueue(await listCaptures(projectId));
      try {
        const fd = new FormData();
        fd.append('file', new File([item.blob], item.fileName, { type: item.blob.type }));
        fd.append('project_id', item.projectId);
        fd.append('tag', item.tag);
        fd.append('caption', item.caption);
        const res = await uploadPhotoAction(fd);
        if (res.ok) {
          await removeCapture(item.id);
          synced += 1;
        } else {
          await updateCapture(item.id, { status: 'failed', error: res.error });
        }
      } catch (err) {
        await updateCapture(item.id, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Sync failed',
        });
      }
      setQueue(await listCaptures(projectId));
    }
    setFlushing(false);
    if (synced > 0) {
      toast.success(synced === 1 ? '1 capture synced.' : `${synced} captures synced.`);
      router.refresh();
    }
  }, [flushing, projectId, router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh();

    function onOnline() {
      setOnline(true);
      void flush();
    }
    function onOffline() {
      setOnline(false);
    }
    // PhotoUpload dispatches this after stashing a capture offline.
    function onQueued() {
      void refresh();
    }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('heyhenry:capture-queued', onQueued);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('heyhenry:capture-queued', onQueued);
    };
  }, [refresh, flush]);

  if (queue.length === 0 && online) return null;

  const waiting = queue.filter((q) => q.status !== 'syncing').length;

  return (
    <div className="space-y-2" data-slot="offline-capture-queue" data-count={queue.length}>
      {!online ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-900/50 dark:bg-amber-900/20">
          <CloudOff
            className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
            aria-hidden
          />
          <p className="text-amber-900 dark:text-amber-200">
            <span className="font-semibold">You&rsquo;re offline.</span> Capture keeps working —{' '}
            {queue.length} {queue.length === 1 ? 'capture is' : 'captures are'} waiting to sync.
            We&rsquo;ll push them up the moment you have signal.
          </p>
        </div>
      ) : null}

      {queue.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                online ? 'bg-emerald-500' : 'bg-amber-500',
              )}
              aria-hidden
            />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
              Pending sync
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              · {waiting} of {queue.length} waiting
            </span>
            {online ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => void flush()}
                disabled={flushing}
              >
                {flushing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                {queue.some((q) => q.status === 'failed') ? 'Retry all' : 'Sync now'}
              </Button>
            ) : null}
          </div>
          <ul className="divide-y">
            {queue.map((item) => (
              <QueueRow key={item.id} item={item} tz={tz} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function QueueRow({ item, tz }: { item: QueuedCapture; tz: string }) {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(item.blob);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [item.blob]);

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="size-11 shrink-0 overflow-hidden rounded-lg border bg-muted">
        {thumb ? (
          // biome-ignore lint/performance/noImgElement: local blob preview
          <img src={thumb} alt="" className="size-full object-cover" aria-hidden />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {photoTagLabels[item.tag as keyof typeof photoTagLabels] ?? 'Photo'}
          {item.caption ? ` · ${item.caption}` : ''}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          Captured {formatDateTime(new Date(item.capturedAt), { timezone: tz, timeStyle: 'short' })}{' '}
          · {humanBytes(item.bytes)}
        </p>
        {item.status === 'failed' && item.error ? (
          <p className="text-[11px] text-destructive">{item.error}</p>
        ) : null}
      </div>
      <StatusPill status={item.status} />
    </li>
  );
}

function StatusPill({ status }: { status: QueuedCapture['status'] }) {
  if (status === 'syncing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
        <Loader2 className="size-2.5 animate-spin" />
        Syncing
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-red-800 dark:bg-red-900/30 dark:text-red-300">
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
      Waiting
    </span>
  );
}
