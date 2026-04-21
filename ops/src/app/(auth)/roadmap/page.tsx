import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase';
import { NewItemForm } from './new-item-form';

const LANES = ['product', 'marketing', 'ops', 'sales', 'research'] as const;
const STATUS_ORDER: readonly string[] = ['backlog', 'up_next', 'in_progress', 'done'];
const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  up_next: 'Up next',
  in_progress: 'In progress',
  done: 'Done',
};

export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string }>;
}) {
  const { lane: laneFilter } = await searchParams;
  const activeLane = LANES.includes(laneFilter as (typeof LANES)[number])
    ? (laneFilter as (typeof LANES)[number])
    : null;

  const service = createServiceClient();
  let query = service
    .schema('ops')
    .from('roadmap_items')
    .select(
      'id, lane, status, priority, title, body, assignee, tags, actor_type, actor_name, source_idea_id, created_at, status_changed_at',
    )
    .neq('status', 'archived')
    .order('status_changed_at', { ascending: false })
    .limit(500);
  if (activeLane) query = query.eq('lane', activeLane);
  const { data: items } = await query;

  const byStatus: Record<string, typeof items> = {};
  for (const s of STATUS_ORDER) byStatus[s] = [];
  for (const it of items ?? []) byStatus[it.status]?.push(it);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roadmap</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Product, marketing, ops, sales, research — all in one board. Agents can drop cards via
            API; humans move them through the statuses here.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 text-xs">
          <Link
            href="/roadmap"
            className={`rounded px-2 py-1 ${
              activeLane === null
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'border border-[var(--border)] hover:bg-[var(--muted)]'
            }`}
          >
            All
          </Link>
          {LANES.map((l) => (
            <Link
              key={l}
              href={`/roadmap?lane=${l}`}
              className={`rounded px-2 py-1 capitalize ${
                activeLane === l
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'border border-[var(--border)] hover:bg-[var(--muted)]'
              }`}
            >
              {l}
            </Link>
          ))}
        </nav>
      </header>

      <NewItemForm defaultLane={activeLane ?? 'product'} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STATUS_ORDER.map((s) => (
          <section key={s} className="space-y-2">
            <h2 className="sticky top-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              {STATUS_LABEL[s]}{' '}
              <span className="text-[var(--muted-foreground)]/70">
                ({(byStatus[s] ?? []).length})
              </span>
            </h2>
            <ul className="space-y-2">
              {(byStatus[s] ?? []).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/roadmap/${item.id}`}
                    className="block rounded-md border border-[var(--border)] p-3 text-sm transition hover:border-[var(--foreground)]"
                  >
                    <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                      <span>{item.lane}</span>
                      {item.priority ? (
                        <span className="text-amber-500">{'★'.repeat(item.priority)}</span>
                      ) : null}
                      {item.source_idea_id ? (
                        <span className="rounded bg-[var(--muted)] px-1">from idea</span>
                      ) : null}
                    </div>
                    <div className="font-medium">{item.title}</div>
                    {item.assignee ? (
                      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                        @{item.assignee}
                      </div>
                    ) : null}
                  </Link>
                </li>
              ))}
              {(byStatus[s] ?? []).length === 0 ? (
                <li className="rounded-md border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted-foreground)]">
                  Empty
                </li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
