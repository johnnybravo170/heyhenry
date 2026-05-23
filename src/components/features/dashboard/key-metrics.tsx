import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import type { KeyMetrics as KeyMetricsData } from '@/lib/db/queries/dashboard';

/** Mono eyebrow — small uppercase label used on stat cells across the Paper surfaces. */
const EYEBROW = 'font-mono text-[11px] uppercase tracking-wide text-muted-foreground';

export function KeyMetrics({
  metrics,
  revenueYtdCents,
  isRenovation = false,
}: {
  metrics: KeyMetricsData;
  revenueYtdCents: number;
  /** Renovation/tile GCs work in projects, not jobs/quotes — swap the
   * operational tiles accordingly. */
  isRenovation?: boolean;
}) {
  type MetricCard = {
    label: string;
    cents?: number;
    count?: number;
    detail: React.ReactNode;
    href: string;
  };

  const moneyCards: MetricCard[] = [
    {
      label: 'Revenue this month',
      cents: metrics.revenueThisMonthCents,
      detail: (
        <>
          YTD: <Money cents={revenueYtdCents} />
        </>
      ),
      href: '/invoices?status=paid',
    },
    {
      label: 'Outstanding',
      cents: metrics.outstandingCents,
      detail: 'Sent invoices awaiting payment',
      href: '/invoices?status=sent',
    },
  ];

  const operationalCards: MetricCard[] = isRenovation
    ? [
        {
          label: 'Active projects',
          count: metrics.activeProjectsCount,
          detail: 'In progress',
          href: '/projects?view=active',
        },
        {
          label: 'Awaiting approval',
          count: metrics.awaitingApprovalCount,
          detail: 'Estimate sent, awaiting customer',
          href: '/projects?view=awaiting_approval',
        },
      ]
    : [
        {
          label: 'Open jobs',
          count: metrics.openJobsCount,
          detail: 'Booked or in progress',
          href: '/jobs',
        },
        {
          label: 'Pending quotes',
          count: metrics.pendingQuotesCount,
          detail: 'Sent, awaiting response',
          href: '/quotes?status=sent',
        },
      ];

  const cards = [...moneyCards, ...operationalCards];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Link key={card.label} href={card.href}>
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardDescription className={EYEBROW}>{card.label}</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">
                {card.cents !== undefined ? <Money cents={card.cents} /> : card.count}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{card.detail}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
