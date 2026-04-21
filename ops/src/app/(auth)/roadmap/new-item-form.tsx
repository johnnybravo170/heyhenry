'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createRoadmapItemAction } from './actions';

const LANES = ['product', 'marketing', 'ops', 'sales', 'research'];

export function NewItemForm({ defaultLane }: { defaultLane: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [lane, setLane] = useState(defaultLane);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createRoadmapItemAction({
        lane,
        title: title.trim(),
        body: body.trim() || null,
      });
      if (r.ok) {
        setTitle('');
        setBody('');
        setOpen(false);
        toast.success('Card created.');
        router.refresh();
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
        + New card
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-md border border-[var(--border)] p-3">
      <div className="flex gap-2">
        <select
          value={lane}
          onChange={(e) => setLane(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-white px-2 py-2 text-sm"
        >
          {LANES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input
          type="text"
          required
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      <textarea
        rows={2}
        placeholder="Body (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
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
          disabled={isPending || !title.trim()}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create card'}
        </button>
      </div>
    </form>
  );
}
