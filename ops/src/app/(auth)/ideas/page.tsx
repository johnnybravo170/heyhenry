import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase';
import { fmtDate } from '@/lib/tz';

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  in_progress: 'In progress',
  done: 'Done',
  rejected: 'Rejected',
};

const STATUS_DOT: Record<string, string> = {
  new: 'bg-sky-500',
  reviewed: 'bg-amber-500',
  in_progress: 'bg-violet-500',
  done: 'bg-emerald-500',
  rejected: 'bg-red-500',
};

export default async function IdeasPage() {
  const service = createServiceClient();
  const { data: ideas } = await service
    .schema('ops')
    .from('ideas')
    .select('id, title, body, actor_type, actor_name, status, rating, tags, created_at')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ideas</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Agents drop ideas here via API. Open one to leave feedback, rate it, or trigger a
          followup.
        </p>
      </header>

      {ideas && ideas.length > 0 ? (
        <ul className="space-y-2">
          {ideas.map((i) => (
            <li key={i.id}>
              <Link
                href={`/ideas/${i.id}`}
                className="block rounded-md border border-[var(--border)] p-4 transition hover:border-[var(--foreground)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2 rounded-full ${STATUS_DOT[i.status] ?? 'bg-zinc-400'}`}
                      />
                      <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                        {STATUS_LABEL[i.status] ?? i.status}
                      </span>
                      {i.actor_type === 'agent' ? (
                        <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                          agent
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1 text-sm font-medium">{i.title}</h3>
                    {i.body ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--muted-foreground)]">
                        {i.body}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-[var(--muted-foreground)]">
                    <span>{fmtDate(i.created_at)}</span>
                    <span>{i.actor_name}</span>
                    {i.rating ? (
                      <span className="text-amber-500">{'★'.repeat(i.rating)}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
          No ideas yet. Ask an agent to POST to <code>/api/ops/ideas</code>.
        </p>
      )}
    </div>
  );
}
