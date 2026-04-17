import { Gift, TrendingUp, UserCheck, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type StatsData = {
  total: number;
  signed_up: number;
  converted: number;
  rewards: number;
};

const statCards = [
  { key: 'total' as const, label: 'Referrals Sent', icon: Users },
  { key: 'signed_up' as const, label: 'Signups', icon: UserCheck },
  { key: 'converted' as const, label: 'Conversions', icon: TrendingUp },
  { key: 'rewards' as const, label: 'Rewards Earned', icon: Gift },
];

export function ReferralStats({ stats }: { stats: StatsData }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {statCards.map(({ key, label, icon: Icon }) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{label}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {key === 'rewards' ? `$${stats[key]}` : stats[key]}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
