'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { searchKnowledgeAction } from './actions';

type Hit = {
  doc_id: string;
  title: string;
  body: string;
  tags: string[];
  similarity: number;
};

export function SearchForm() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    startTransition(async () => {
      const r = await searchKnowledgeAction(q.trim());
      if (r.ok) setHits(r.hits);
      else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="search"
          placeholder="Plain-English search — e.g. 'how does the memo transcribe flow work'"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button
          type="submit"
          disabled={isPending || !q.trim()}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {isPending ? 'Searching…' : 'Search'}
        </button>
      </form>
      {hits !== null ? (
        <div className="rounded-md border border-[var(--border)] p-2">
          {hits.length === 0 ? (
            <p className="p-3 text-sm text-[var(--muted-foreground)]">
              No matches above 0.4 similarity.
            </p>
          ) : (
            <ul className="space-y-1">
              {hits.map((h) => (
                <li key={h.doc_id}>
                  <Link
                    href={`/knowledge/${h.doc_id}`}
                    className="block rounded px-3 py-2 text-sm hover:bg-[var(--muted)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">{h.title}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {(h.similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted-foreground)]">
                      {h.body.slice(0, 160)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
