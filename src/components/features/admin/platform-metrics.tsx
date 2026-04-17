import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlatformStats } from '@/lib/db/queries/admin';

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

type Props = {
  stats: PlatformStats;
};

export function PlatformMetrics({ stats }: Props) {
  const cards = [
    {
      label: 'Total operators',
      value: stats.totalTenants,
      detail: 'Registered businesses on the platform.',
    },
    {
      label: 'Total jobs',
      value: stats.totalJobs,
      detail: 'Jobs across all tenants.',
    },
    {
      label: 'Total revenue',
      value: formatCents(stats.totalRevenueCents),
      detail: 'Sum of all paid invoices.',
    },
    {
      label: 'Active operators (30d)',
      value: stats.activeTenantsLast30Days,
      detail: 'Tenants with activity in the last 30 days.',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">{card.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
