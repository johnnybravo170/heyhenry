'use client';

/**
 * Step 2 — business profile, trimmed to the day-1-visible trust fields:
 * logo + GST + WCB + province. Address/website/socials stay deferred to
 * Settings ▸ Profile (linked as "More business details"). Each field carries
 * payoff microcopy — "this is what your clients see on the estimate."
 *
 * Reuses the existing `LogoUploader` (as-is) and the shared
 * `updateBusinessProfileAction` so Settings stays the one canonical writer.
 * A failed save NEVER blocks advancing — it's all skippable.
 */

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { LogoUploader } from '@/components/features/settings/logo-uploader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeProvinceCode, PROVINCE_OPTIONS } from '@/lib/tax/provinces';
import { updateBusinessProfileAction } from '@/server/actions/profile';
import type { OnboardingProfile } from './onboarding-flow';
import { StepActions } from './onboarding-flow';

export function ProfileStep({
  profile,
  onContinue,
  onSkip,
}: {
  profile: OnboardingProfile;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [gstNumber, setGstNumber] = useState(profile.gstNumber);
  const [wcbNumber, setWcbNumber] = useState(profile.wcbNumber);
  const [province, setProvince] = useState(normalizeProvinceCode(profile.province) ?? '');
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const res = await updateBusinessProfileAction({
        // Preserve the business name + the deferred Settings fields by passing
        // through whatever's already there (empty for a fresh tenant); we only
        // collect the three day-1 fields here.
        name: profile.businessName,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        province,
        postalCode: profile.postalCode,
        phone: profile.phone,
        contactEmail: profile.contactEmail,
        websiteUrl: profile.websiteUrl,
        reviewUrl: profile.reviewUrl,
        gstNumber,
        wcbNumber,
      });
      if (!res.ok) {
        // Surface but don't trap — the owner can still continue.
        toast.error(res.error);
      } else {
        toast.success('Saved.');
      }
      onContinue();
    });
  }

  return (
    <>
      <h1 className="text-[22px] leading-tight font-bold tracking-[-0.02em] text-foreground">
        Make it look like your business.
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This is what your <span className="text-foreground/80">clients</span> see on every estimate
        and invoice. All optional — finish later from Settings.
      </p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-foreground/80">Logo</Label>
          <LogoUploader currentLogoUrl={profile.logoSignedUrl} />
          <p className="text-xs leading-snug text-muted-foreground">
            <span className="text-foreground/80">
              Goes on every estimate and invoice your clients see.
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="ob-gst" className="text-xs font-semibold text-foreground/80">
              GST number
            </Label>
            <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              Optional
            </span>
          </div>
          <Input
            id="ob-gst"
            value={gstNumber}
            onChange={(e) => setGstNumber(e.target.value)}
            placeholder="123456789 RT0001"
            inputMode="numeric"
            className="h-11 tabular-nums"
          />
          <p className="text-xs leading-snug text-muted-foreground">
            <span className="text-foreground/80">Shown in the footer</span> of estimates and
            invoices.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="ob-wcb" className="text-xs font-semibold text-foreground/80">
              WCB account number
            </Label>
            <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              Optional
            </span>
          </div>
          <Input
            id="ob-wcb"
            value={wcbNumber}
            onChange={(e) => setWcbNumber(e.target.value)}
            placeholder="WCB-1234567"
            className="h-11"
          />
          <p className="text-xs leading-snug text-muted-foreground">
            <span className="text-foreground/80">Shown in the footer</span> alongside GST.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-prov" className="text-xs font-semibold text-foreground/80">
            Province
          </Label>
          <select
            id="ob-prov"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">— Pick —</option>
            {PROVINCE_OPTIONS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
          <p className="text-xs leading-snug text-muted-foreground">
            <span className="text-foreground/80">Sets the right sales tax</span> (GST / PST / HST)
            on your first estimate.
          </p>
        </div>

        <a
          href="/settings/profile"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground underline-offset-[3px] hover:underline"
        >
          More business details →
        </a>
      </div>

      <StepActions
        primaryLabel="Save & continue"
        onPrimary={handleSave}
        onSkip={onSkip}
        pending={pending}
      />
    </>
  );
}
