import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase';
import { fmtDate } from '@/lib/tz';
import { NewDecisionForm } from './new-decision-form';

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  measuring: 'Measuring',
  learned: 'Learned',
  reverted: 'Reverted',
  abandoned: 'Abandoned',
};

const STATUS_DOT: Record<string, string> = {
  open: 'bg-sky-500',
  measuring: 'bg-amber-500',
  learned: 'bg-emerald-500',
  reverted: 'bg-red-500',
  abandoned: 'bg-zinc-400',
};

export default async function DecisionsPage() {
  const service = createServiceClient();
  const { data: decisions } = await service
    .schema('ops')
    .from('decisions')
    .select('id, title, hypothesis, status, actor_type, actor_name, tags, created_at')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Hypothesis → action → outcome → learning. Every meaningful call the business makes gets
          logged so future-us (or future-agents) can see why.
        </p>
      </header>

      <NewDecisionForm />

      {decisions && decisions.length > 0 ? (
        <ul className="space-y-2">
          {decisions.map((d) => (
            <li key={d.id}>
              <Link
                href={`/decisions/${d.id}`}
                className="block rounded-md border border-[var(--border)] p-4 transition hover:border-[var(--foreground)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2 rounded-full ${STATUS_DOT[d.status] ?? 'bg-zinc-400'}`}
                      />
                      <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                        {STATUS_LABEL[d.status] ?? d.status}
                      </span>
                      {d.actor_type === 'agent' ? (
                        <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                          agent
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1 text-sm font-medium">{d.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted-foreground)]">
                      {d.hypothesis}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--muted-foreground)]">
                    <div>{fmtDate(d.created_at)}</div>
                    <div>{d.actor_name}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
          No decisions yet.
        </p>
      )}
    </div>
  );
}
