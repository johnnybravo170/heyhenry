'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createKnowledgeDocAction } from './actions';

export function NewDocForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createKnowledgeDocAction({
        title: title.trim(),
        body: body.trim(),
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (r.ok && r.id) {
        toast.success('Doc created + embedded.');
        router.push(`/knowledge/${r.id}`);
      } else if (!r.ok) {
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
        + New doc
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-md border border-[var(--border)] p-4">
      <input
        type="text"
        required
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <textarea
        required
        rows={10}
        placeholder="Body (markdown)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <input
        type="text"
        placeholder="tags, comma-separated"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
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
          disabled={isPending || !title.trim() || !body.trim()}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {isPending ? 'Saving + embedding…' : 'Create doc'}
        </button>
      </div>
    </form>
  );
}
