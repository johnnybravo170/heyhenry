'use server';

/**
 * First-run setup pass server actions (/onboarding).
 *
 * The flow is intentionally thin: it sequences + frames existing machinery
 * (profile actions, plan picker, FirstRunHero) behind a skippable/resumable
 * step shell. These actions only touch the two onboarding marker columns on
 * `tenants` plus the one genuinely new write — choosing a vertical post-signup
 * (which re-seeds the vertical-specific expense categories).
 *
 * Every step is skippable; none of these actions ever block the dashboard.
 * The resume marker is `tenants.onboarding_step`; completion is
 * `tenants.onboarding_completed_at` (see
 * 20260524040346_onboarding_progress_marker.sql).
 */

import { revalidatePath } from 'next/cache';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { isSelectableVertical } from '@/lib/onboarding/verticals';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type OnboardingActionResult = { ok: true } | { ok: false; error: string };

// Re-export the vertical type so existing `@/server/actions/onboarding`
// type-importers keep working. The runtime helpers live in the plain module
// (a `'use server'` file may only export async server actions).
export type { SelectableVertical } from '@/lib/onboarding/verticals';

/**
 * Persist the chosen vertical (step 1). If it differs from the tenant's
 * current vertical, re-run the vertical-specific expense-category seeds so the
 * starter set matches the trade. `signup_tenant` hardcoded `renovation`, so
 * the pressure-washing path always re-seeds.
 *
 * Re-seed uses the admin client because `seed_default_expense_categories` is
 * granted to service_role only. It's ON CONFLICT DO NOTHING, so re-running is
 * safe — it only fills gaps for the newly-chosen vertical.
 */
export async function setOnboardingVerticalAction(
  vertical: string,
): Promise<OnboardingActionResult> {
  if (!isSelectableVertical(vertical)) {
    return { ok: false, error: 'Unknown trade. Pick one of the options.' };
  }

  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const changed = tenant.vertical !== vertical;

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({ vertical, updated_at: new Date().toISOString() })
    .eq('id', tenant.id);
  if (error) return { ok: false, error: error.message };

  if (changed) {
    // Re-seed the vertical's starter expense categories. Best-effort: a seed
    // failure must not block the owner from continuing (value is never gated).
    const admin = createAdminClient();
    const { error: seedErr } = await admin.rpc('seed_default_expense_categories', {
      p_tenant_id: tenant.id,
      p_vertical: vertical,
    });
    if (seedErr) {
      console.warn('Vertical re-seed failed (non-fatal):', seedErr.message);
    }
  }

  // Vertical drives DB-driven nav + FirstRunHero variant + Henry's vertical
  // prompt; revalidate the whole tree so the next render picks it up.
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Record the furthest step the owner has reached so a mid-flow bail resumes in
 * the right place. Monotonic — never walks the marker backwards (so hitting
 * Back then leaving doesn't lose progress).
 */
export async function setOnboardingStepAction(step: number): Promise<OnboardingActionResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const supabase = await createClient();
  // Only advance; the `.lt()` guard makes this a no-op when the owner is
  // already past `step` (e.g. they hit Back), so the resume marker never
  // walks backwards. A matched-no-rows result is success, not an error.
  const { error } = await supabase
    .from('tenants')
    .update({ onboarding_step: step, updated_at: new Date().toISOString() })
    .eq('id', tenant.id)
    .lt('onboarding_step', step);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/**
 * Mark the setup pass done. Idempotent — re-completing is a no-op. Stamps
 * `onboarding_completed_at` so the /onboarding guard sends the owner straight
 * to /dashboard from here on. Reached by finishing OR skipping through the
 * final step; value was never gated on what they actually filled in.
 */
export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenant.id)
    .is('onboarding_completed_at', null);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard');
  return { ok: true };
}
