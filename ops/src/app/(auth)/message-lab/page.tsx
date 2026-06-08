import { listArchetypes } from '@/server/ops-services/message-lab';
import { MessageLabForm } from './message-lab-form';

export const dynamic = 'force-dynamic';

export default async function MessageLabPage() {
  const archetypes = await listArchetypes({ vertical: 'general_contractor' });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Message Lab</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          A synthetic focus group of {archetypes.length} Canadian GC customer archetypes. Drop in
          copy or a URL; each archetype reacts in character and gives a buy / no-buy verdict with
          reasons. The score is the purchase split; the objections are the punch list to rewrite
          against.
        </p>
      </header>

      <MessageLabForm />

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          The panel
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {archetypes.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            >
              <span>{a.emoji}</span>
              <span className="font-medium">{a.name}</span>
              <span className="ml-auto text-xs text-[var(--muted-foreground)]">
                {a.evidence_basis}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
