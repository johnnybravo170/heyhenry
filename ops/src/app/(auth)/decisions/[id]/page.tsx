import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase';
import { fmtDateTime } from '@/lib/tz';
import { CommentForm } from './comment-form';
import { DecisionActions } from './decision-actions';
import { OutcomeForm } from './outcome-form';

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  measuring: 'Measuring',
  learned: 'Learned',
  reverted: 'Reverted',
  abandoned: 'Abandoned',
};

export default async function DecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: d } = await service
    .schema('ops')
    .from('decisions')
    .select(
      'id, title, hypothesis, action, status, actor_type, actor_name, tags, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (!d) notFound();

  const [{ data: outcomes }, { data: comments }] = await Promise.all([
    service
      .schema('ops')
      .from('decision_outcomes')
      .select('id, actor_type, actor_name, body, metrics, concluded_at, created_at')
      .eq('decision_id', id)
      .order('created_at'),
    service
      .schema('ops')
      .from('decision_comments')
      .select('id, actor_type, actor_name, body, created_at')
      .eq('decision_id', id)
      .order('created_at'),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href="/decisions" className="text-xs text-[var(--muted-foreground)] hover:underline">
        ← Decisions
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="uppercase tracking-wide">{STATUS_LABEL[d.status as string]}</span>
          {d.actor_type === 'agent' ? (
            <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
              agent
            </span>
          ) : null}
          <span>· by {d.actor_name}</span>
          <span>· {fmtDateTime(d.created_at as string)}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
      </header>

      <DecisionActions
        id={id}
        status={d.status as string}
        action={(d.action as string | null) ?? ''}
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold">Hypothesis</h2>
        <p className="whitespace-pre-wrap rounded-md border border-[var(--border)] p-3 text-sm leading-relaxed">
          {d.hypothesis}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Outcomes {outcomes && outcomes.length > 0 ? `(${outcomes.length})` : ''}
        </h2>
        {outcomes && outcomes.length > 0 ? (
          <ul className="space-y-2">
            {outcomes.map((o) => (
              <li key={o.id} className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="mb-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <span className="font-medium text-[var(--foreground)]">{o.actor_name}</span>
                  {o.actor_type !== 'human' ? (
                    <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] uppercase">
                      {o.actor_type}
                    </span>
                  ) : null}
                  <span>· {fmtDateTime(o.created_at as string)}</span>
                  {o.concluded_at ? <span>· concluded</span> : null}
                </div>
                <p className="whitespace-pre-wrap">{o.body}</p>
                {o.metrics && Object.keys(o.metrics as object).length > 0 ? (
                  <pre className="mt-2 overflow-x-auto rounded bg-[var(--muted)] p-2 text-[11px]">
                    {JSON.stringify(o.metrics, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <OutcomeForm decisionId={id} />
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
                  <span>· {fmtDateTime(c.created_at as string)}</span>
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <CommentForm decisionId={id} />
      </section>
    </div>
  );
}
