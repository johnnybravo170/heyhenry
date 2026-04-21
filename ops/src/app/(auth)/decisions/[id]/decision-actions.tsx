'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setDecisionActionAction, setDecisionStatusAction } from './actions';

const STATUSES = ['open', 'measuring', 'learned', 'reverted', 'abandoned'] as const;

export function DecisionActions({
  id,
  status,
  action,
}: {
  id: string;
  status: string;
  action: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(status);
  const [actionText, setActionText] = useState(action);
  const [editing, setEditing] = useState(false);

  function onStatus(next: string) {
    setLocalStatus(next);
    startTransition(async () => {
      const r = await setDecisionStatusAction(id, next);
      if (!r.ok) {
        setLocalStatus(status);
        toast.error(r.error);
      } else router.refresh();
    });
  }

  function onSaveAction() {
    startTransition(async () => {
      const r = await setDecisionActionAction(id, actionText.trim() || null);
      if (r.ok) {
        setEditing(false);
        toast.success('Action saved.');
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="space-y-3 rounded-md border border-[var(--border)] p-4">
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
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Action</span>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-[var(--muted-foreground)] hover:underline"
            >
              edit
            </button>
          ) : null}
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              rows={3}
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              placeholder="What we're actually doing"
              className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setActionText(action);
                  setEditing(false);
                }}
                className="text-sm text-[var(--muted-foreground)] hover:underline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSaveAction}
                disabled={isPending}
                className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : actionText ? (
          <p className="whitespace-pre-wrap rounded-md bg-[var(--muted)] p-3 text-sm">
            {actionText}
          </p>
        ) : (
          <p className="rounded-md border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)]">
            No action recorded yet. Click edit to fill in what we did.
          </p>
        )}
      </div>
    </section>
  );
}
