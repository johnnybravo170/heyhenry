import { getScoutPolicyReviewState } from '@/server/ops-services/scout-policy';
import { PolicyCard, type PolicyView } from './policy-card';

export const dynamic = 'force-dynamic';

export default async function ScoutPolicyPage() {
  const { proposed, activeBySlug } = await getScoutPolicyReviewState();

  const proposedViews: Array<{ proposed: PolicyView; active: PolicyView | null }> = proposed.map(
    (p) => ({
      proposed: p as PolicyView,
      active: (activeBySlug[p.scout_slug] as PolicyView) ?? null,
    }),
  );

  const activeRows = Object.values(activeBySlug) as PolicyView[];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Scout Policy</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          The file-or-skip rulebook each scout reads at run-start. The scout-learner proposes new
          versions here; you activate or reject. Activating supersedes the scout&apos;s current
          policy atomically — exactly one active version per scout, always.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Proposed — awaiting review
          </h2>
          <span className="text-xs text-[var(--muted-foreground)]">{proposedViews.length}</span>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          Each shows the proposed rulebook beside the scout&apos;s current active version, if any.
        </p>
        {proposedViews.length > 0 ? (
          <div className="space-y-2">
            {proposedViews.map((v) => (
              <PolicyCard key={v.proposed.id} proposed={v.proposed} active={v.active} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--muted-foreground)]">
            Nothing to review. Proposals appear here when the scout-learner runs.
          </p>
        )}
      </section>

      <section className="space-y-3 border-t border-[var(--border)] pt-6">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Active policies</h2>
          <span className="text-xs text-[var(--muted-foreground)]">{activeRows.length}</span>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          What each scout is currently running. A scout with no row here runs its baseline prompt
          unchanged.
        </p>
        {activeRows.length > 0 ? (
          <div className="space-y-2">
            {activeRows.map((a) => (
              <div key={a.id} className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-semibold">{a.scout_slug}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    v{a.version} · active since{' '}
                    {a.activated_at ? new Date(a.activated_at).toISOString().slice(0, 10) : '—'}
                  </span>
                </div>
                <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-[var(--border)] bg-[var(--muted)] p-3 text-xs">
                  {JSON.stringify(a.policy, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--muted-foreground)]">
            No active policies yet — every scout is on its baseline prompt.
          </p>
        )}
      </section>
    </div>
  );
}
