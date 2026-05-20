import { KeyMetrics } from '@/components/features/dashboard/key-metrics';
import { NeedsAttention } from '@/components/features/dashboard/needs-attention';
import { RecentActivity } from '@/components/features/dashboard/recent-activity';
import { requireTenant } from '@/lib/auth/helpers';
import { getRecentActivityFeed } from '@/lib/db/queries/activity-feed';
import { getAttentionItems, getKeyMetrics, getRevenueYtd } from '@/lib/db/queries/dashboard';

export async function MetricsSection() {
  const { tenant } = await requireTenant();
  const tz = tenant.timezone;
  const isRenovation = tenant.vertical === 'renovation' || tenant.vertical === 'tile';

  const [metrics, revenueYtdCents, attentionItems, recentActivity] = await Promise.all([
    getKeyMetrics(tz, isRenovation),
    getRevenueYtd(tz),
    getAttentionItems(tz, isRenovation),
    getRecentActivityFeed(),
  ]);

  return (
    <>
      <KeyMetrics metrics={metrics} revenueYtdCents={revenueYtdCents} isRenovation={isRenovation} />
      <NeedsAttention items={attentionItems} />
      <RecentActivity entries={recentActivity} timezone={tz} />
    </>
  );
}
