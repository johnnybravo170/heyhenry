'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { activateScoutPolicyAction, rejectScoutPolicyAction } from './actions';

export type PolicyView = {
  id: string;
  scout_slug: string;
  version: number;
  status: string;
  policy: Record<string, unknown>;
  proposed_by: string;
  rationale: string | null;
  activated_at: string | null;
  created_at: string;
};

export function PolicyCard({
  proposed,
  active,
}: {
  proposed: PolicyView;
  active: PolicyView | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<'idle' | 'reject'>('idle');
  const [note, setNote] = useState('');

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
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-semibold">{proposed.scout_slug}</span>
        <span className="text-xs text-[var(--muted-foreground)]">
          proposed v{proposed.version} · by {proposed.proposed_by} ·{' '}
          {new Date(proposed.created_at).toISOString().slice(0, 10)}
        </span>
      </div>

      {proposed.rationale ? (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Rationale
          </p>
          <pre className="whitespace-pre-wrap font-sans text-xs text-[var(--muted-foreground)]">
            {proposed.rationale}
          </pre>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Proposed v{proposed.version}
          </p>
          <pre className="max-h-72 overflow-auto rounded-md border border-[var(--border)] bg-[var(--muted)] p-3 text-xs">
            {JSON.stringify(proposed.policy, null, 2)}
          </pre>
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            {active ? `Currently active v${active.version}` : 'No active policy yet'}
          </p>
          {active ? (
            <pre className="max-h-72 overflow-auto rounded-md border border-[var(--border)] bg-[var(--muted)] p-3 text-xs">
              {JSON.stringify(active.policy, null, 2)}
            </pre>
          ) : (
            <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
              This scout is on its baseline prompt. Activating sets its first learned policy.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => activateScoutPolicyAction(proposed.id), 'Activated.')}
          className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {active ? `Activate (supersedes v${active.version})` : 'Activate'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setMode(mode === 'reject' ? 'idle' : 'reject')}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {mode === 'reject' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="why (optional — the learner reads this)"
            className="flex-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(async () => {
                const r = await rejectScoutPolicyAction({ id: proposed.id, note });
                if (r.ok) setNote('');
                return r;
              }, 'Rejected.')
            }
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Confirm reject
          </button>
        </div>
      ) : null}
    </div>
  );
}
