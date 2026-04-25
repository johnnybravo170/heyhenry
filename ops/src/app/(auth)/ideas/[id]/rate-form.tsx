'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { fmtDateTime } from '@/lib/tz';
import { rateIdeaFeedbackAction } from './actions';

const RATINGS = [
  { value: -2, label: '−2', hint: 'never again' },
  { value: -1, label: '−1', hint: 'low signal' },
  { value: 1, label: '+1', hint: 'good' },
  { value: 2, label: '+2', hint: 'more like this' },
] as const;

function ratingLabel(r: number): string {
  return r > 0 ? `+${r}` : `${r}`;
}

export function RateForm({
  ideaId,
  currentRating,
  currentReason,
  ratedAt,
}: {
  ideaId: string;
  currentRating: number | null;
  currentReason: string | null;
  ratedAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(currentRating === null);
  const [rating, setRating] = useState<number | null>(currentRating);
  const [reason, setReason] = useState<string>(currentReason ?? '');
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === null) {
      toast.error('Pick a rating.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Reason required.');
      return;
    }
    startTransition(async () => {
      const r = await rateIdeaFeedbackAction(ideaId, rating, reason);
      if (r.ok) {
        toast.success(`Rated ${ratingLabel(rating)}.`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  if (!open && currentRating !== null) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2 text-xs">
        <span className="font-mono font-semibold">{ratingLabel(currentRating)}</span>
        <span className="flex-1 truncate text-[var(--muted-foreground)]">
          {currentReason ?? ''}
          {ratedAt ? ` · ${fmtDateTime(ratedAt)}` : ''}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--muted)]"
        >
          Re-rate
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-[var(--border)] p-3">
      <div className="flex flex-wrap gap-2">
        {RATINGS.map((r) => {
          const active = rating === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => setRating(r.value)}
              className={`flex flex-col items-center rounded-md border px-3 py-1.5 text-xs ${
                active
                  ? 'border-[var(--foreground)] bg-[var(--muted)]'
                  : 'border-[var(--border)] hover:bg-[var(--muted)]'
              }`}
            >
              <span className="font-mono font-semibold">{r.label}</span>
              <span className="text-[10px] text-[var(--muted-foreground)]">{r.hint}</span>
            </button>
          );
        })}
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        required
        rows={2}
        placeholder="Why? (required, max 500 chars)"
        className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--muted-foreground)]">
          Scouts read these ratings before producing new ideas.
        </span>
        <div className="flex gap-2">
          {currentRating !== null ? (
            <button
              type="button"
              onClick={() => {
                setRating(currentRating);
                setReason(currentReason ?? '');
                setOpen(false);
              }}
              disabled={isPending}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save rating'}
          </button>
        </div>
      </div>
    </form>
  );
}
