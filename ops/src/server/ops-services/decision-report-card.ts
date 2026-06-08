import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Command Center report card — retrospective calibration over decision_bundles.
 *
 * Per bucket, over a trailing window: how often did Jonathan ACT (resolved) vs
 * DISMISS (archived / "never") vs PARK, and how did he rate the recommendation?
 * The routine reads this (Step 8) to stop surfacing classes he keeps dismissing;
 * the human sees the same table at the bottom of /admin/queue.
 */

export type BucketReport = {
  bucket: string;
  total: number;
  acted: number;
  dismissed: number;
  parked: number;
  open: number;
  /** Mean recommendation rating (1-5) over rated bundles in the window, or null. */
  avg_rating: number | null;
  /** acted / (acted + dismissed) — the "was this worth surfacing" signal. */
  act_rate: number | null;
};

type Row = { bucket: string; status: string; rating: number | null };

export async function getDecisionReportCard(
  service: SupabaseClient,
  days = 60,
): Promise<{ days: number; buckets: BucketReport[] }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await service
    .schema('ops')
    .from('decision_bundles')
    .select('bucket, status, rating')
    .gte('surfaced_at', since)
    .limit(5000);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];
  const byBucket = new Map<string, { r: Row[] }>();
  for (const row of rows) {
    if (!byBucket.has(row.bucket)) byBucket.set(row.bucket, { r: [] });
    byBucket.get(row.bucket)?.r.push(row);
  }

  const buckets: BucketReport[] = [...byBucket.entries()]
    .map(([bucket, { r }]) => {
      const acted = r.filter((x) => x.status === 'resolved').length;
      const dismissed = r.filter((x) => x.status === 'archived').length;
      const parked = r.filter((x) => x.status === 'parked').length;
      const open = r.filter((x) => x.status === 'open').length;
      const rated = r.map((x) => x.rating).filter((n): n is number => typeof n === 'number');
      const decided = acted + dismissed;
      return {
        bucket,
        total: r.length,
        acted,
        dismissed,
        parked,
        open,
        avg_rating: rated.length
          ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10
          : null,
        act_rate: decided ? Math.round((acted / decided) * 100) / 100 : null,
      };
    })
    .sort((a, b) => b.total - a.total);

  return { days, buckets };
}
