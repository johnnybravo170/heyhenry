'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Markdown } from '@/app/(auth)/board/markdown';
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
  before_image_url: string | null;
  after_image_url: string | null;
  image_caption: string | null;
};

function optionChoice(o: Option): string {
  return (o.key ?? o.label ?? '').toString();
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
      {children}
    </p>
  );
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

  const options = bundle.options ?? [];

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="max-w-[68ch]">
        <p className="text-[15px] font-semibold leading-snug">{bundle.question}</p>

        {bundle.why_today ? (
          <div className="mt-3">
            <Eyebrow>Why today</Eyebrow>
            <div className="text-[var(--muted-foreground)]">
              <Markdown>{bundle.why_today}</Markdown>
            </div>
          </div>
        ) : null}

        {bundle.recommendation ? (
          <div className="mt-3">
            <Eyebrow>Recommendation</Eyebrow>
            <Markdown>{bundle.recommendation}</Markdown>
          </div>
        ) : null}
      </div>

      {bundle.before_image_url || bundle.after_image_url ? (
        <div className="mt-3">
          {bundle.image_caption ? (
            <p className="mb-2 text-xs text-[var(--muted-foreground)]">{bundle.image_caption}</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {bundle.before_image_url ? (
              <figure className="min-w-0">
                <figcaption className="mb-1 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                  Before
                </figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bundle.before_image_url}
                  alt="defect screenshot (before)"
                  className="max-h-64 rounded-md border border-[var(--border)]"
                />
              </figure>
            ) : null}
            {bundle.after_image_url ? (
              <figure className="min-w-0">
                <figcaption className="mb-1 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                  After
                </figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bundle.after_image_url}
                  alt="screenshot after fix"
                  className="max-h-64 rounded-md border border-[var(--border)]"
                />
              </figure>
            ) : null}
          </div>
        </div>
      ) : null}

      {isParked && bundle.resurface_trigger ? (
        <p className="mt-3 text-xs text-amber-600">
          Parked → resurfaces on {bundle.resurface_trigger}
        </p>
      ) : null}

      {/* Choices — bordered rows, not filled slabs, so a full-sentence option
          reads as text instead of a wall of white-on-black. */}
      <div className="mt-4 max-w-[68ch] space-y-2">
        {options.length > 0 ? (
          options.map((o, i) => {
            const meta = [
              o.blast_radius && `blast: ${o.blast_radius}`,
              o.unblocks && `unblocks: ${o.unblocks}`,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
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
                className="flex w-full items-start gap-3 rounded-md border border-[var(--border)] p-3 text-left transition-colors hover:border-[var(--foreground)] disabled:opacity-50"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-[var(--muted)] font-mono text-[11px] font-medium">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm leading-snug">{o.label ?? o.key}</span>
                  {meta ? (
                    <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                      {meta}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
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
      </div>

      {/* Secondary actions + rating */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
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
