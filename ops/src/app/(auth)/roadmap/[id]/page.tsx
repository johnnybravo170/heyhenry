import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase';
import { CommentForm } from './comment-form';
import { ItemActions } from './item-actions';

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  up_next: 'Up next',
  in_progress: 'In progress',
  done: 'Done',
  archived: 'Archived',
};

export default async function RoadmapItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: item } = await service
    .schema('ops')
    .from('roadmap_items')
    .select(
      'id, lane, status, priority, title, body, assignee, tags, actor_type, actor_name, source_idea_id, created_at, status_changed_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (!item) notFound();

  const [{ data: comments }, { data: activity }] = await Promise.all([
    service
      .schema('ops')
      .from('roadmap_comments')
      .select('id, actor_type, actor_name, body, created_at')
      .eq('item_id', id)
      .order('created_at'),
    service
      .schema('ops')
      .from('roadmap_activity')
      .select('id, actor_type, actor_name, kind, from_value, to_value, note, created_at')
      .eq('item_id', id)
      .order('created_at'),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href="/roadmap" className="text-xs text-[var(--muted-foreground)] hover:underline">
        ← Roadmap
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="capitalize">{item.lane}</span>
          <span>·</span>
          <span className="uppercase tracking-wide">
            {STATUS_LABEL[item.status as string] ?? (item.status as string)}
          </span>
          {item.priority ? (
            <span className="text-amber-500">{'★'.repeat(item.priority as number)}</span>
          ) : null}
          <span>· by {item.actor_name}</span>
          <span>· {new Date(item.created_at as string).toLocaleString()}</span>
          {item.source_idea_id ? (
            <Link
              href={`/ideas/${item.source_idea_id}`}
              className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] hover:underline"
            >
              from idea
            </Link>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
        {item.body ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.body}</p>
        ) : null}
        {Array.isArray(item.tags) && item.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {(item.tags as string[]).map((t) => (
              <span key={t} className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px]">
                #{t}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <ItemActions
        id={id}
        status={item.status as string}
        priority={(item.priority as number | null) ?? null}
        assignee={(item.assignee as string | null) ?? ''}
        lane={item.lane as string}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Activity</h2>
        <ul className="space-y-1">
          {(activity ?? []).map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]"
            >
              <span className="font-medium text-[var(--foreground)]">{a.actor_name}</span>
              <span> · </span>
              <span className="font-mono">{a.kind}</span>
              {a.from_value || a.to_value ? (
                <span>
                  : {a.from_value ?? '—'} → {a.to_value ?? '—'}
                </span>
              ) : null}
              {a.note ? <span> — {a.note}</span> : null}
              <span className="ml-2">{new Date(a.created_at as string).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Comments {comments && comments.length > 0 ? `(${comments.length})` : ''}
        </h2>
        {comments && comments.length > 0 ? (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                <div className="mb-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <span className="font-medium text-[var(--foreground)]">{c.actor_name}</span>
                  {c.actor_type !== 'human' ? (
                    <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] uppercase">
                      {c.actor_type}
                    </span>
                  ) : null}
                  <span>· {new Date(c.created_at as string).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <CommentForm itemId={id} />
      </section>
    </div>
  );
}
