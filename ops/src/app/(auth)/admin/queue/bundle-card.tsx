'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { archiveBundleAction, parkBundleAction, resolveBundleAction } from './actions';

type Option = { key?: string; label?: string; blast_radius?: string; unblocks?: string };

export type QueueBundle = {
  id: string;
  bucket: string;
  status: string;
  question: string;
  recommendation: string | null;
  why_today: string | null;
  options: Option[] | null;
  links: Array<Record<string, unknown>> | null;
  resurface_trigger: string | null;
};

function optionChoice(o: Option): string {
  return (o.key ?? o.label ?? '').toString();
}

export function BundleCard({ bundle }: { bundle: QueueBundle }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<'idle' | 'park' | 'never'>('idle');
  const [trigger, setTrigger] = useState('resurface:v1');
  const [note, setNote] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);

  const isParked = bundle.status === 'parked';

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="rounded-md border border-[var(--border)] p-4">
      <p className="text-sm font-medium">{bundle.question}</p>

      {bundle.why_today ? (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          <span className="font-medium uppercase tracking-wide">Why today:</span> {bundle.why_today}
        </p>
      ) : null}

      {bundle.recommendation ? (
        <p className="mt-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Recommendation:{' '}
          </span>
          {bundle.recommendation}
        </p>
      ) : null}

      {isParked && bundle.resurface_trigger ? (
        <p className="mt-2 text-xs text-amber-600">
          Parked → resurfaces on {bundle.resurface_trigger}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {bundle.options && bundle.options.length > 0 ? (
          bundle.options.map((o, i) => (
            <button
              key={optionChoice(o) || i}
              type="button"
              disabled={isPending}
              onClick={() =>
                run(
                  () => resolveBundleAction({ id: bundle.id, choice: optionChoice(o), rating }),
                  'Resolved.',
                )
              }
              className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              title={[
                o.blast_radius && `blast: ${o.blast_radius}`,
                o.unblocks && `unblocks: ${o.unblocks}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              {o.label ?? o.key}
            </button>
          ))
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => resolveBundleAction({ id: bundle.id, choice: 'do_it', rating }),
                'Marked do-it.',
              )
            }
            className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
          >
            Do it
          </button>
        )}

        {!isParked ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setMode(mode === 'park' ? 'idle' : 'park')}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--foreground)] disabled:opacity-50"
          >
            Not now
          </button>
        ) : null}

        <button
          type="button"
          disabled={isPending}
          onClick={() => setMode(mode === 'never' ? 'idle' : 'never')}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:border-[var(--foreground)] disabled:opacity-50"
        >
          Never
        </button>

        <select
          value={rating ?? ''}
          onChange={(e) => setRating(e.target.value ? Number(e.target.value) : undefined)}
          className="ml-auto rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs text-[var(--muted-foreground)]"
          title="Rate this recommendation (report card)"
        >
          <option value="">rate…</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}★
            </option>
          ))}
        </select>
      </div>

      {mode === 'park' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          <input
            type="text"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="resurface:v1"
            className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="note (optional)"
            className="flex-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <button
            type="button"
            disabled={isPending || !trigger.trim()}
            onClick={() =>
              run(
                () =>
                  parkBundleAction({
                    id: bundle.id,
                    resurface_trigger: trigger.trim(),
                    note,
                    rating,
                  }),
                'Parked.',
              )
            }
            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Park
          </button>
        </div>
      ) : null}

      {mode === 'never' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="reason (one line)"
            className="flex-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(() => archiveBundleAction({ id: bundle.id, note, rating }), 'Dismissed.')
            }
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Confirm never
          </button>
        </div>
      ) : null}
    </div>
  );
}
