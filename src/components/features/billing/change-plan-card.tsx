'use client';

/**
 * Plan-change UI: pick a plan + cycle, preview proration, confirm. Server
 * action calls `subscriptions.update` with `proration_behavior:
 * 'create_prorations'`. Webhook flips local plan once Stripe acks.
 *
 * Seat-silent: the Select shows plan name + flat $/mo only. PLAN_CATALOG
 * still carries `seatBand` strings — they are NEVER rendered here (flat-rate,
 * intent-led positioning; per-seat language is banned on this screen).
 *
 * Grandfather-honest: for founding members, a ✦ Henry guard fires the moment
 * a different tier is picked — it warns (reassuringly, reversibly) that
 * switching moves them to current pricing, with the exact number shown at
 * Preview before anything changes.
 */

import { Info, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import type { Plan } from '@/lib/billing/features';
import { type BillingCycle, formatCad, PLAN_CATALOG } from '@/lib/billing/plans';
import {
  changePlanAction,
  type PlanChangePreview,
  previewPlanChangeAction,
} from '@/server/actions/billing-management';

type Preview = Extract<PlanChangePreview, { ok: true }>;

const PLANS: Plan[] = ['starter', 'growth', 'pro', 'scale'];

export function ChangePlanCard({
  currentPlan,
  currentCycle,
  foundingMember = false,
  upgradeTier = null,
}: {
  currentPlan: Plan;
  currentCycle: BillingCycle;
  /** Grandfathered member — fires the ✦ Henry grandfather guard on tier change. */
  foundingMember?: boolean;
  /** `?upgrade=<tier>` deep-link — pre-selects this tier and scrolls into view. */
  upgradeTier?: Plan | null;
}) {
  const tz = useTenantTimezone();
  const [plan, setPlan] = useState<Plan>(upgradeTier ?? currentPlan);
  const [cycle, setCycle] = useState<BillingCycle>(currentCycle);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const [confirming, startConfirm] = useTransition();
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  // Inbound `?upgrade=<tier>` — scroll the card into view so the deep-link
  // from a LockedFeature CTA lands on the pre-selected tier.
  useEffect(() => {
    if (upgradeTier) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [upgradeTier]);

  const isUnchanged = plan === currentPlan && cycle === currentCycle;
  // Guard fires for founding members the moment they pick a different tier —
  // switching tiers is the one moment the grandfathered rate is at risk.
  const showGrandfatherGuard = foundingMember && plan !== currentPlan;

  function handlePreview() {
    setPreview(null);
    setPreviewError(null);
    startPreview(async () => {
      const r = await previewPlanChangeAction({ plan, cycle });
      if (!r.ok) {
        setPreviewError(r.error);
        return;
      }
      setPreview(r);
    });
  }

  function handleConfirm() {
    startConfirm(async () => {
      const r = await changePlanAction({ plan, cycle });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Plan updated.');
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <Card className="shadow-none" ref={cardRef}>
      <CardHeader>
        <CardTitle>Change plan</CardTitle>
        <CardDescription>
          Switch tier or billing cycle. Upgrades charge a prorated difference now; downgrades credit
          the unused portion against the next invoice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="plan-select">Plan</Label>
            <Select
              value={plan}
              onValueChange={(v) => {
                setPlan(v as Plan);
                setPreview(null);
                setPreviewError(null);
              }}
            >
              <SelectTrigger id="plan-select" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => {
                  const copy = PLAN_CATALOG[p];
                  // Seat-silent: name + flat $/mo only. NEVER copy.seatBand.
                  return (
                    <SelectItem key={p} value={p}>
                      {copy.name} — {formatCad(copy.monthlyCadCents)}/mo
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cycle-select">Billing cycle</Label>
            <Select
              value={cycle}
              onValueChange={(v) => {
                setCycle(v as BillingCycle);
                setPreview(null);
                setPreviewError(null);
              }}
            >
              <SelectTrigger id="cycle-select" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly (20% off)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {showGrandfatherGuard ? (
          <div
            role="note"
            className="flex items-start gap-3 rounded-lg border border-brand/25 border-l-[3px] border-l-brand bg-[#FEF0E3] p-3 text-sm leading-relaxed text-foreground/90"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-card text-brand">
              <Sparkles aria-hidden className="size-3.5" />
            </span>
            <p className="flex-1">
              <span className="mr-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
                Henry
              </span>
              You're on your founding rate, locked. Switching to{' '}
              <strong className="font-semibold">{PLAN_CATALOG[plan].name}</strong> moves you to
              today's pricing — we'll show the exact number below before anything changes. Hit{' '}
              <em>Back</em> any time and your founding rate stays put.
            </p>
          </div>
        ) : null}

        {preview ? (
          <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
            {preview.immediateChargeCents > 0 ? (
              <p>
                Charging{' '}
                <strong>{formatCents(preview.immediateChargeCents, preview.currency)}</strong> now
                (prorated difference).
              </p>
            ) : preview.immediateChargeCents < 0 ? (
              <p>
                You'll receive a credit of{' '}
                <strong>
                  {formatCents(Math.abs(preview.immediateChargeCents), preview.currency)}
                </strong>{' '}
                against the next invoice.
              </p>
            ) : (
              <p>No immediate charge.</p>
            )}
            <p className="text-muted-foreground">
              Next renewal: {formatDate(preview.nextRenewalDate, tz)} for{' '}
              {formatCents(preview.nextRenewalAmountCents, preview.currency)}.
            </p>
          </div>
        ) : previewError ? (
          <p className="text-sm text-destructive">{previewError}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {preview ? (
            <>
              <Button type="button" onClick={handleConfirm} disabled={confirming}>
                {confirming ? 'Updating…' : 'Confirm change'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreview(null)}
                disabled={confirming}
              >
                Back
              </Button>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info aria-hidden className="size-3.5" />
                Plan updates after Stripe acks the change.
              </span>
            </>
          ) : (
            <Button
              type="button"
              onClick={handlePreview}
              disabled={isUnchanged || previewing}
              variant="outline"
            >
              {previewing ? 'Calculating…' : 'Preview change'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function formatDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}
