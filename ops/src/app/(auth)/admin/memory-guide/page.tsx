import {
  CROSS_LINKING_PATTERNS,
  SURFACES,
  THREE_SECOND_HEURISTIC,
} from '@/server/ops-services/memory-guide';

export default function MemoryGuidePage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Memory guide</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">
          Five surfaces. Each has one job. Pick the right one before writing so humans and agents
          never rehash the same work. This page mirrors the <code>ops_memory_guide</code> MCP tool.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          The 3-second heuristic
        </h2>
        <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
          {THREE_SECOND_HEURISTIC.map((h) => (
            <li key={h} className="px-4 py-2 font-mono text-sm">
              {h}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Surfaces
        </h2>
        {SURFACES.map((s) => (
          <article key={s.key} className="rounded-md border border-[var(--border)] p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold">{s.label}</h3>
              <a
                href={s.admin_path}
                className="text-xs text-[var(--muted-foreground)] hover:underline"
              >
                open {s.admin_path} →
              </a>
            </div>
            <p className="mt-1 text-sm">{s.oneLiner}</p>

            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Use for
                </div>
                <ul className="list-inside list-disc space-y-1">
                  {s.useFor.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Do NOT use for
                </div>
                <ul className="list-inside list-disc space-y-1">
                  {s.doNotUseFor.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 text-xs text-[var(--muted-foreground)]">
              <div>
                Write tool: <code>{s.write_tool}</code>
              </div>
              <div>
                Read tools:{' '}
                {s.read_tools.map((t, i) => (
                  <span key={t}>
                    {i > 0 ? ', ' : ''}
                    <code>{t}</code>
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Examples
              </div>
              <ul className="space-y-1 text-sm">
                {s.examples.map((e) => (
                  <li key={e} className="italic">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Cross-linking patterns
        </h2>
        <ul className="list-inside list-disc space-y-2 text-sm">
          {CROSS_LINKING_PATTERNS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-dashed border-[var(--border)] p-4 text-sm">
        <strong>Rule of thumb:</strong> If you&rsquo;re writing the same idea twice to two surfaces,
        STOP. Write it once to the right surface, then cross-link from the others.
      </section>
    </div>
  );
}
