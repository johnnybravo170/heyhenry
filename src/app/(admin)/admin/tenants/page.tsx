import { TenantTable } from '@/components/features/admin/tenant-table';
import { listTenantsWithStats } from '@/lib/db/queries/admin';

export default async function AdminTenantsPage() {
  const tenants = await listTenantsWithStats();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <p className="text-sm text-muted-foreground">
          {tenants.length} {tenants.length === 1 ? 'tenant' : 'tenants'} total, sorted by recent
          activity.
        </p>
      </div>
      <TenantTable tenants={tenants} />
    </div>
  );
}
