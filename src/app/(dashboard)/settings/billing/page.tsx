import { CreditCard, Info, Lock } from 'lucide-react';
import Link from 'next/link';
import { CancelSubscriptionButton } from '@/components/features/billing/cancel-subscription-button';
import { ChangePlanCard } from '@/components/features/billing/change-plan-card';
import { InvoicesTable } from '@/components/features/billing/invoices-table';
import { PaymentMethodCard } from '@/components/features/billing/payment-method-card';
import { ResumeSubscriptionButton } from '@/components/features/billing/resume-subscription-button';
import { OwnerOnlyPane } from '@/components/features/settings/owner-only-pane';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireTenant } from '@/lib/auth/helpers';
import { formatCad, isPlan, PLAN_CATALOG } from '@/lib/billing/plans';
import { getPrimaryOperatorName } from '@/lib/db/queries/profile';
import {
  type SubscriptionCockpitState,
  statusToneClass,
  statusToneIcon,
  subscriptionStateLabel,
  subscriptionStateTone,
} from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import { getBillingOverviewAction } from '@/server/actions/billing-management';

/**
 * Billing settings — fully native HeyHenry UI for plan, payment method,
 * invoice history, and self-serve cancel/pause. This is the GC's OWN
 * subscription to HeyHenry (they pay us) — not customer AR, not Stripe
 * Connect. Restyled to the Paper palette: rust is the single accent
 * (reserved for the grandfather promise + the one primary per card).
 *
 * Dates render in the tenant's timezone (not the viewer's local) so a
 * "next renewal Mon Jun 3" message matches what the customer sees on the
 * invoice rather than shifting by a day across the date line.
 */
export default async function BillingPage({
  searchParams,
}: {
  // `?upgrade=<tier>` deep-link from LockedFeature CTAs — pre-selects the
  // Change-plan tier and scrolls it into view.
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { tenant } = await requireTenant();

  // Owner-only. Members + admins who deep-link here get the calm refusal
  // pane instead of plan-management UI they can't act on. (The nav already
  // hides this destination for both roles — this is defense-in-depth.)
  if (tenant.member.role !== 'owner') {
    const owner = await getPrimaryOperatorName(tenant.id);
    const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || null;
    return (
      <OwnerOnlyPane
        title="Billing & subscription"
        description={`Billing is managed by the account owner — the plan, payment method, and invoices for ${tenant.name}.`}
        ownerName={ownerName}
      />
    );
  }

  const [overview, { upgrade }] = await Promise.all([getBillingOverviewAction(), searchParams]);
  const upgradeTier = isPlan(upgrade) ? upgrade : null;
  const tz = tenant.timezone;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Your plan, payment method, invoices, and subscription. See the{' '}
          <Link href="/refund-policy" className="underline underline-offset-2">
            refund policy
          </Link>{' '}
          for what happens when you cancel.
        </p>
      </div>

      {!overview.hasSubscription ? (
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <CreditCard className="size-5" aria-hidden />
              </div>
              <div>
                <CardTitle>No active subscription</CardTitle>
                <CardDescription>
                  Pick a plan to unlock the full HeyHenry feature set — your data, projects, and
                  customers are all preserved.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link
              href="/onboarding/plan"
              className="text-sm font-semibold underline underline-offset-2"
            >
              Choose a plan →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <PlanStatusCockpit overview={overview} tz={tz} />
          <PaymentMethodCard card={overview.defaultCard} />
          <ChangePlanCard
            currentPlan={overview.plan}
            currentCycle={overview.cycle}
            foundingMember={overview.foundingMember}
            upgradeTier={upgradeTier}
          />
          <InvoicesTable />
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Cancel subscription</CardTitle>
              <CardDescription>
                Stops auto-renewal and refunds the unused portion of the current billing period to
                your original card. You keep access through the end of the period you've already
                paid for.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                No phone call required. See the{' '}
                <Link href="/refund-policy" className="underline underline-offset-2">
                  refund policy
                </Link>
                .
              </p>
              <CancelSubscriptionButton />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

type Overview = Extract<
  Awaited<ReturnType<typeof getBillingOverviewAction>>,
  { hasSubscription: true }
>;

/**
 * Derive the cockpit state from the overview. This layers `pausedUntil` and
 * `cancelAtPeriodEnd` on top of the raw Stripe status so the pill reads as a
 * lifecycle state, not a generic status string.
 */
function cockpitState(overview: Overview): SubscriptionCockpitState {
  if (overview.pausedUntil !== null) return 'paused';
  if (overview.status === 'past_due' || overview.status === 'unpaid') return 'past_due';
  if (overview.status === 'canceled') return 'canceled';
  if (overview.cancelAtPeriodEnd) return 'cancel_at_period_end';
  if (overview.status === 'trialing') return 'trialing';
  return 'active';
}

function PlanStatusCockpit({ overview, tz }: { overview: Overview; tz: string }) {
  const planCopy = PLAN_CATALOG[overview.plan];
  const state = cockpitState(overview);
  const tone = subscriptionStateTone[state];
  const PillIcon = statusToneIcon[tone];
  const renewalDate = overview.currentPeriodEnd ? formatDate(overview.currentPeriodEnd, tz) : null;
  const trialDate = overview.trialEndsAt ? formatDate(overview.trialEndsAt, tz) : null;
  const pausedUntilDate =
    overview.pausedUntil && overview.pausedUntil !== 'indefinite'
      ? formatDate(overview.pausedUntil, tz)
      : null;
  const card = overview.defaultCard;
  const cardLine = card ? `${capitalize(card.brand)} •••• ${card.last4}` : 'your card on file';

  // State-first headline + subhead. One headline per state.
  let headline: string;
  let subhead: React.ReactNode;
  switch (state) {
    case 'trialing':
      headline = trialDate ? `Trial — ends ${trialDate}.` : 'Trial in progress.';
      subhead = renewalDate ? (
        <>
          First charge on <span className="text-foreground">{renewalDate}</span> to {cardLine}.
        </>
      ) : (
        <>Pick the plan that fits before the trial ends — change anytime.</>
      );
      break;
    case 'past_due':
      headline = `Payment failed — update card to restore ${planCopy.name} features.`;
      subhead = <>Features fall back to Starter until the card succeeds.</>;
      break;
    case 'paused':
      headline = pausedUntilDate ? `Paused — resumes ${pausedUntilDate}.` : 'Subscription paused.';
      subhead = <>Billing and access are paused — your data stays put.</>;
      break;
    case 'cancel_at_period_end':
      headline = renewalDate
        ? `Cancellation pending — access until ${renewalDate}.`
        : 'Cancellation pending.';
      subhead = <>Auto-renewal is off. Your data is preserved after access ends.</>;
      break;
    case 'canceled':
      headline = 'Canceled — access ended; your data is preserved.';
      subhead = (
        <Link href="/onboarding/plan" className="underline underline-offset-2">
          Reactivate a plan →
        </Link>
      );
      break;
    default:
      headline = renewalDate ? `Next renewal ${renewalDate}.` : 'Your subscription is active.';
      subhead = (
        <>
          Auto-renews to <span className="text-foreground">{cardLine}</span>. GST receipt arrives in
          your inbox the next morning.
        </>
      );
  }

  return (
    <Card
      className={cn(
        'shadow-none',
        state === 'past_due' && 'border-amber-300 ring-1 ring-amber-200',
      )}
    >
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span className="text-foreground">{planCopy.name}</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="capitalize">{overview.cycle}</span>
              <span className="text-muted-foreground/60">·</span>
              <span>HeyHenry subscription</span>
            </div>
            <CardTitle className="leading-snug">{headline}</CardTitle>
            <CardDescription className="mt-1 tabular-nums">{subhead}</CardDescription>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Badge variant="secondary" className={cn('gap-1 font-medium', statusToneClass[tone])}>
              <PillIcon aria-hidden className="size-3" />
              {subscriptionStateLabel[state]}
            </Badge>
            {overview.foundingMember ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-[#FEF0E3] px-2.5 py-1 text-xs font-semibold text-brand"
                title="Locked sign-up rate — never moves while you stay"
              >
                <Lock aria-hidden className="size-3" />
                <span className="font-mono text-[11px] uppercase tracking-[0.06em]">
                  Founding rate
                </span>
                <span className="tabular-nums">· locked</span>
              </span>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {state === 'paused' || state === 'past_due' || overview.foundingMember ? (
        <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t bg-paper-soft py-3 text-sm">
          {state === 'paused' ? (
            <>
              <span className="text-muted-foreground">
                Resume anytime to pick up where you left off.
              </span>
              <ResumeSubscriptionButton />
            </>
          ) : state === 'past_due' ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              Stripe will retry automatically — or update the card above to restore access now.
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Info aria-hidden className="size-3.5 shrink-0 text-muted-foreground/60" />
              List price for {planCopy.name} today is{' '}
              <strong className="font-semibold text-foreground tabular-nums">
                {formatCad(planCopy.monthlyCadCents)}/mo
              </strong>
              . Your rate doesn't move while you stay on {planCopy.name}.
            </span>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function formatDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}
