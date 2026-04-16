import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const STATS = [
  { label: 'Quotes this week', value: '0' },
  { label: 'Open jobs', value: '0' },
  { label: 'Unpaid invoices', value: '0' },
] as const;

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Your activity snapshot will live here.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {STATS.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl font-semibold">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Coming in Phase 1</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
