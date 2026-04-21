'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { archiveKnowledgeDocAction, updateKnowledgeDocAction } from '../actions';

export function DocEditor({
  id,
  initialTitle,
  initialBody,
  initialTags,
  meta,
}: {
  id: string;
  initialTitle: string;
  initialBody: string;
  initialTags: string;
  meta: { actorName: string; updatedAt: string; embeddingUpdatedAt: string | null };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [tags, setTags] = useState(initialTags);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function onSave() {
    startTransition(async () => {
      const r = await updateKnowledgeDocAction({
        id,
        title: title.trim(),
        body,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (r.ok) {
        toast.success('Saved.');
        setEditing(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function onArchive() {
    if (!confirm('Archive this doc?')) return;
    startTransition(async () => {
      const r = await archiveKnowledgeDocAction(id);
      if (r.ok) {
        toast.success('Archived.');
        router.push('/knowledge');
      } else {
        toast.error(r.error);
      }
    });
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-[var(--muted-foreground)]">
              by {meta.actorName} · updated {new Date(meta.updatedAt).toLocaleString()}
              {meta.embeddingUpdatedAt ? (
                <>
                  {' · embedded '}
                  {new Date(meta.embeddingUpdatedAt).toLocaleString()}
                </>
              ) : (
                ' · not yet embedded'
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--muted)]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onArchive}
                disabled={isPending}
                className="text-xs text-[var(--destructive)] hover:underline"
              >
                Archive
              </button>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{initialTitle}</h1>
          {initialTags ? (
            <div className="flex flex-wrap gap-1">
              {initialTags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => (
                  <span key={t} className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px]">
                    #{t}
                  </span>
                ))}
            </div>
          ) : null}
        </header>
        <article className="whitespace-pre-wrap rounded-md border border-[var(--border)] bg-white p-4 font-mono text-sm leading-relaxed">
          {initialBody}
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <textarea
        rows={22}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <input
        type="text"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="tags, comma-separated"
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setTitle(initialTitle);
            setBody(initialBody);
            setTags(initialTags);
            setEditing(false);
          }}
          className="text-sm text-[var(--muted-foreground)] hover:underline"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isPending}
          className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {isPending ? 'Saving + re-embedding…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
