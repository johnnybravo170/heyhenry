import { PlatformMetrics } from '@/components/features/admin/platform-metrics';
import { TenantTable } from '@/components/features/admin/tenant-table';
import { getPlatformStats, listTenantsWithStats } from '@/lib/db/queries/admin';

export default async function AdminDashboardPage() {
  const [stats, tenants] = await Promise.all([getPlatformStats(), listTenantsWithStats()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform overview</h1>
        <p className="text-sm text-muted-foreground">All operators and platform-wide metrics.</p>
      </div>

      <PlatformMetrics stats={stats} />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Operators</h2>
        <TenantTable tenants={tenants} />
      </div>
    </div>
  );
}
