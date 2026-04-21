'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  assignIdeaAction,
  queueFollowupAction,
  rateIdeaAction,
  setIdeaStatusAction,
} from './actions';

const STATUSES = ['new', 'reviewed', 'in_progress', 'done', 'rejected'] as const;

export function IdeaActions({
  id,
  status,
  rating,
  assignee,
}: {
  id: string;
  status: string;
  rating: number | null;
  assignee: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(status);
  const [localRating, setLocalRating] = useState(rating);
  const [localAssignee, setLocalAssignee] = useState(assignee);

  function onStatus(next: string) {
    setLocalStatus(next);
    startTransition(async () => {
      const r = await setIdeaStatusAction(id, next);
      if (!r.ok) {
        toast.error(r.error);
        setLocalStatus(status);
      } else {
        router.refresh();
      }
    });
  }

  function onRate(n: number) {
    const next = localRating === n ? null : n;
    setLocalRating(next);
    startTransition(async () => {
      const r = await rateIdeaAction(id, next);
      if (!r.ok) {
        toast.error(r.error);
        setLocalRating(rating);
      } else {
        router.refresh();
      }
    });
  }

  function onAssign() {
    startTransition(async () => {
      const r = await assignIdeaAction(id, localAssignee.trim() || null);
      if (r.ok) {
        toast.success('Assignee saved.');
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function onFollowup(kind: 'promote_to_roadmap' | 'assign' | 'generic_followup') {
    const note = prompt(
      kind === 'generic_followup'
        ? 'Note for the followup (visible to agents)?'
        : 'Optional note (visible to downstream system)?',
    );
    if (note === null) return;
    startTransition(async () => {
      const r = await queueFollowupAction(id, kind, note ? { note } : {});
      if (r.ok) {
        toast.success('Followup queued.');
        router.refresh();
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
          <div className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">Rating</div>
          <div className="flex gap-1 text-xl">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onRate(n)}
                disabled={isPending}
                className={
                  localRating && n <= localRating
                    ? 'text-amber-500'
                    : 'text-[var(--muted-foreground)] hover:text-amber-300'
                }
                aria-label={`Rate ${n}`}
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
              placeholder="name / agent / email"
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

      <div className="border-t border-[var(--border)] pt-3">
        <div className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
          Followup actions
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onFollowup('promote_to_roadmap')}
            disabled={isPending}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--muted)]"
          >
            Promote to roadmap
          </button>
          <button
            type="button"
            onClick={() => onFollowup('assign')}
            disabled={isPending}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--muted)]"
          >
            Request assignment
          </button>
          <button
            type="button"
            onClick={() => onFollowup('generic_followup')}
            disabled={isPending}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--muted)]"
          >
            Generic followup
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
          Queued items sit pending until the downstream system (roadmap, assignment engine, etc.)
          picks them up. They won't get lost.
        </p>
      </div>
    </section>
  );
}
