import { Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { type Feature, type Plan, requiredTier } from '@/lib/billing/features';
import { cn } from '@/lib/utils';

const PLAN_LABEL: Record<Plan, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  scale: 'Scale',
};

type Props = {
  feature: Feature;
  /** Optional override; defaults to the feature's required tier. */
  tier?: Plan;
  /** Short human label for what's locked, e.g. "SMS reminders". */
  label?: string;
  className?: string;
};

/**
 * Render in place of a gated feature when the tenant's plan is too low.
 * Per spec, gated features are visible-but-locked — never hidden.
 */
export function LockedFeature({ feature, tier, label, className }: Props) {
  const required = tier ?? requiredTier(feature);
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Lock className="size-4" />
        <span>
          {label ?? feature} is on the {PLAN_LABEL[required]} plan
        </span>
      </div>
      <Button asChild size="sm" variant="default">
        <Link href={`/settings/billing?upgrade=${required}`}>
          Upgrade to {PLAN_LABEL[required]}
        </Link>
      </Button>
    </div>
  );
}
