import { createServiceClient } from '@/lib/supabase';
import { BundleCard, type QueueBundle } from './bundle-card';

export const dynamic = 'force-dynamic';

type Stream = {
  key: string;
  label: string;
  blurb: string;
  bundles: QueueBundle[];
};

export default async function QueuePage() {
  const service = createServiceClient();

  const { data: open } = await service
    .schema('ops')
    .from('decision_bundles')
    .select(
      'id, bucket, status, question, recommendation, why_today, options, links, resurface_trigger, surfaced_at',
    )
    .eq('status', 'open')
    .order('surfaced_at', { ascending: false })
    .limit(300);

  const { data: parked } = await service
    .schema('ops')
    .from('decision_bundles')
    .select(
      'id, bucket, status, question, recommendation, why_today, options, links, resurface_trigger, surfaced_at',
    )
    .eq('status', 'parked')
    .order('surfaced_at', { ascending: false })
    .limit(100);

  const openRows = (open ?? []) as QueueBundle[];
  const parkedRows = (parked ?? []) as QueueBundle[];
  const byBucket = (b: string) => openRows.filter((r) => r.bucket === b);

  const streams: Stream[] = [
    {
      key: 'decision',
      label: 'Decisions for you',
      blurb: 'Board work stalled on judgment. Pick the call.',
      bundles: byBucket('decision'),
    },
    {
      key: 'research',
      label: 'Research decisions',
      blurb: 'Triaged scout signal worth a call now.',
      bundles: byBucket('research'),
    },
    {
      key: 'shipping',
      label: 'Shipping to PR',
      blurb: 'Auto-shipped ready work (never merged). Wired by the ready arm.',
      bundles: [],
    },
    {
      key: 'go_nogo',
      label: 'Go / no-go',
      blurb: 'Ready but bigger — one-tap dispatch.',
      bundles: byBucket('go_nogo'),
    },
    {
      key: 'grooming',
      label: 'Grooming / Parked',
      blurb: 'Underspecified (groom) or good-but-not-now (parked, resurfaces later).',
      bundles: [...byBucket('grooming'), ...parkedRows],
    },
  ];

  const total = openRows.length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Command Center</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          The Command Center routine&apos;s morning triage. {total} open item
          {total === 1 ? '' : 's'} across five streams. Empty is success — nothing here means
          nothing needs your judgment today.
        </p>
      </header>

      {streams.map((s) => (
        <section key={s.key} className="space-y-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide">{s.label}</h2>
            <span className="text-xs text-[var(--muted-foreground)]">{s.bundles.length}</span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">{s.blurb}</p>
          {s.bundles.length > 0 ? (
            <div className="space-y-2">
              {s.bundles.map((b) => (
                <BundleCard key={b.id} bundle={b} />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--muted-foreground)]">
              Nothing here.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
