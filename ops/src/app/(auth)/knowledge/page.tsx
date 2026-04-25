import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase';
import { fmtDate } from '@/lib/tz';
import { NewDocForm } from './new-doc-form';
import { SearchForm } from './search-form';

export default async function KnowledgePage() {
  const service = createServiceClient();
  const { data: docs } = await service
    .schema('ops')
    .from('knowledge_docs')
    .select('id, slug, title, tags, updated_at, actor_name')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Markdown docs with semantic search. Agents can read + write; use Search to find anything
          from plain English.
        </p>
      </header>

      <SearchForm />
      <NewDocForm />

      {docs && docs.length > 0 ? (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/knowledge/${d.id}`}
                className="block rounded-md border border-[var(--border)] p-3 transition hover:border-[var(--foreground)]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{d.title}</div>
                    {Array.isArray(d.tags) && d.tags.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(d.tags as string[]).map((t) => (
                          <span
                            key={t}
                            className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-[var(--muted-foreground)]">
                    <div>{fmtDate(d.updated_at as string)}</div>
                    <div>{d.actor_name}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
          No docs yet.
        </p>
      )}
    </div>
  );
}
