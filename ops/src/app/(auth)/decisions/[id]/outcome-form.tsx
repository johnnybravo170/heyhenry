'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { addDecisionOutcomeAction } from './actions';

export function OutcomeForm({ decisionId }: { decisionId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [metrics, setMetrics] = useState('');
  const [conclude, setConclude] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    let parsed: Record<string, unknown> = {};
    if (metrics.trim()) {
      try {
        parsed = JSON.parse(metrics);
      } catch {
        toast.error('Metrics must be valid JSON.');
        return;
      }
    }

    startTransition(async () => {
      const r = await addDecisionOutcomeAction(decisionId, body.trim(), parsed, conclude);
      if (r.ok) {
        setBody('');
        setMetrics('');
        setConclude(false);
        toast.success('Outcome recorded.');
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-md border border-[var(--border)] p-3">
      <textarea
        rows={3}
        placeholder="What happened? What did we measure?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <textarea
        rows={2}
        placeholder='Metrics JSON (optional): {"conversion_pct": 3.4, "cost_cents": 1200}'
        value={metrics}
        onChange={(e) => setMetrics(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <input
            type="checkbox"
            checked={conclude}
            onChange={(e) => setConclude(e.target.checked)}
          />
          Mark this as the concluding outcome
        </label>
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Add outcome'}
        </button>
      </div>
    </form>
  );
}
