'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createDecisionAction } from './actions';

export function NewDecisionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [action, setAction] = useState('');
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createDecisionAction({
        title: title.trim(),
        hypothesis: hypothesis.trim(),
        action: action.trim() || null,
      });
      if (r.ok) {
        setTitle('');
        setHypothesis('');
        setAction('');
        setOpen(false);
        toast.success('Decision logged.');
        if (r.id) router.push(`/decisions/${r.id}`);
        else router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
      >
        + Log a decision
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-[var(--border)] p-4">
      <input
        type="text"
        required
        placeholder="Short title — e.g. 'Switch to Gemini for transcription'"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <textarea
        required
        rows={3}
        placeholder="Hypothesis — what do we believe and why?"
        value={hypothesis}
        onChange={(e) => setHypothesis(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <textarea
        rows={2}
        placeholder="Action we're taking (optional at creation — can fill in later)"
        value={action}
        onChange={(e) => setAction(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-[var(--muted-foreground)] hover:underline"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !title.trim() || !hypothesis.trim()}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {isPending ? 'Logging…' : 'Log decision'}
        </button>
      </div>
    </form>
  );
}
