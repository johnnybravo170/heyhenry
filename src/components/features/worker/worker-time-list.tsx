'use client';

import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { WorkerTimeEntry } from '@/lib/db/queries/worker-time';
import { deleteWorkerTimeAction } from '@/server/actions/worker-time';

type Props = { entries: WorkerTimeEntry[] };

function weekStart(iso: string): string {
  // Monday-anchored ISO week start, local.
  const d = new Date(`${iso}T00:00`);
  const day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function formatWeek(iso: string): string {
  const start = new Date(`${iso}T00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const s = start.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });
  const e = end.toLocaleDateString('en-CA', {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
  });
  return `${s} – ${e}`;
}

function canDelete(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

export function WorkerTimeList({ entries }: Props) {
  const [pending, startTransition] = useTransition();

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No time logged yet. Tap &ldquo;Log time&rdquo; to add your first entry.
      </p>
    );
  }

  const groups = new Map<string, WorkerTimeEntry[]>();
  for (const entry of entries) {
    const key = weekStart(entry.entry_date);
    const arr = groups.get(key) ?? [];
    arr.push(entry);
    groups.set(key, arr);
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteWorkerTimeAction(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Entry deleted.');
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {Array.from(groups.entries()).map(([weekKey, rows]) => {
        const total = rows.reduce((s, r) => s + r.hours, 0);
        return (
          <section key={weekKey} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{formatWeek(weekKey)}</h2>
              <span className="text-xs text-muted-foreground">{total.toFixed(2)}h</span>
            </div>
            <div className="divide-y rounded-lg border">
              {rows.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{entry.hours.toFixed(2)}h</span>
                      <span className="text-muted-foreground">
                        {new Date(`${entry.entry_date}T00:00`).toLocaleDateString('en-CA', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="text-sm">
                      {entry.project_name ?? 'Unknown project'}
                      {entry.bucket_name ? (
                        <span className="text-muted-foreground"> · {entry.bucket_name}</span>
                      ) : null}
                    </p>
                    {entry.notes ? (
                      <p className="text-xs text-muted-foreground">{entry.notes}</p>
                    ) : null}
                  </div>
                  {canDelete(entry.created_at) ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      onClick={() => handleDelete(entry.id)}
                      aria-label="Delete entry"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
