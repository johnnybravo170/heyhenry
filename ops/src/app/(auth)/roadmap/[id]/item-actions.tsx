'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  archiveRoadmapItemAction,
  assignRoadmapItemAction,
  setRoadmapItemPriorityAction,
  setRoadmapItemStatusAction,
} from './actions';

const STATUSES = ['backlog', 'up_next', 'in_progress', 'done'] as const;

export function ItemActions({
  id,
  status,
  priority,
  assignee,
}: {
  id: string;
  status: string;
  priority: number | null;
  assignee: string;
  lane: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(status);
  const [localPriority, setLocalPriority] = useState(priority);
  const [localAssignee, setLocalAssignee] = useState(assignee);

  function onStatus(next: string) {
    setLocalStatus(next);
    startTransition(async () => {
      const r = await setRoadmapItemStatusAction(id, next);
      if (!r.ok) {
        setLocalStatus(status);
        toast.error(r.error);
      } else {
        router.refresh();
      }
    });
  }

  function onPriority(n: number) {
    const next = localPriority === n ? null : n;
    setLocalPriority(next);
    startTransition(async () => {
      const r = await setRoadmapItemPriorityAction(id, next);
      if (!r.ok) {
        setLocalPriority(priority);
        toast.error(r.error);
      } else {
        router.refresh();
      }
    });
  }

  function onAssign() {
    startTransition(async () => {
      const r = await assignRoadmapItemAction(id, localAssignee.trim() || null);
      if (r.ok) {
        toast.success('Assignee saved.');
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function onArchive() {
    const reason = prompt('Archive reason (logged):');
    if (!reason) return;
    startTransition(async () => {
      const r = await archiveRoadmapItemAction(id, reason);
      if (r.ok) {
        toast.success('Archived.');
        router.push('/roadmap');
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-md border border-[var(--border)] p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">Status</div>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStatus(s)}
                disabled={isPending}
                className={`rounded px-2 py-1 text-xs transition ${
                  localStatus === s
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'border border-[var(--border)] hover:bg-[var(--muted)]'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">Priority</div>
          <div className="flex gap-1 text-xl">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onPriority(n)}
                disabled={isPending}
                className={
                  localPriority && n <= localPriority
                    ? 'text-amber-500'
                    : 'text-[var(--muted-foreground)] hover:text-amber-300'
                }
                aria-label={`Priority ${n}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">Assignee</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="name / agent"
              value={localAssignee}
              onChange={(e) => setLocalAssignee(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <button
              type="button"
              onClick={onAssign}
              disabled={isPending}
              className="rounded-md bg-[var(--primary)] px-2 py-1 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
      <div className="flex justify-end border-t border-[var(--border)] pt-3">
        <button
          type="button"
          onClick={onArchive}
          disabled={isPending}
          className="text-xs text-[var(--destructive)] hover:underline"
        >
          Archive card
        </button>
      </div>
    </section>
  );
}
