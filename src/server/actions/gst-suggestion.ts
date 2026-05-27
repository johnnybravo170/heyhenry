'use server';

/**
 * GST/HST number suggestion — slice 2 of card 015406d5.
 *
 * The intake parser records any GST/HST numbers it sees on dropped documents
 * (`ParsedIntake.detected_tax_ids`, each with a placement + nearby business
 * name). This module decides whether one of them is the OPERATOR'S OWN number
 * worth offering to save, and handles the save / dismissal.
 *
 * Ownership gate (deliberately conservative — never save someone else's number
 * as the tenant's): we only suggest a number that (a) sits in the document's
 * SENDER / letterhead block, (b) is a valid Canadian GST/HST number, (c) sits
 * next to a business name that fuzzy-matches THIS tenant's name, and (d) hasn't
 * been dismissed — and only when the tenant has no GST number on file yet. A
 * sub-trade quote's sender number is the sub's, so the business-name match is
 * what keeps us from grabbing it.
 */

import { getCurrentTenant } from '@/lib/auth/helpers';
import { getPrefs, updatePrefs } from '@/lib/prefs/tenant-prefs';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidGstNumber, normalizeGstNumber } from '@/lib/validators/tax-id';

export type DetectedTaxId = {
  number: string;
  placement: 'sender' | 'recipient' | 'other';
  near_business_name: string | null;
};

type IntakePrefs = { gst_dismissed_numbers?: string[] };

/** Loose business-name match: drop entity suffixes + trade words, compare tokens. */
function businessNameMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(
        /\b(inc|incorporated|ltd|limited|llc|co|corp|corporation|company|contracting|construction|renovations?|services?|group|enterprises?)\b/g,
        ' ',
      )
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(' ').filter(Boolean));
  const tb = nb.split(' ').filter(Boolean);
  if (tb.length === 0) return false;
  const overlap = tb.filter((t) => ta.has(t)).length;
  // Require a majority of the shorter name's tokens to overlap.
  return overlap >= Math.ceil(Math.min(ta.size, tb.length) / 2);
}

async function getDismissedNumbers(tenantId: string): Promise<Set<string>> {
  const prefs = await getPrefs<IntakePrefs>(tenantId, 'intake');
  const list = Array.isArray(prefs.gst_dismissed_numbers) ? prefs.gst_dismissed_numbers : [];
  return new Set(list.map(normalizeGstNumber));
}

/**
 * Returns the operator's-own GST number to offer (formatted as printed), or
 * null if there's nothing to suggest. Pure read — no writes.
 */
export async function evaluateGstSuggestionAction(
  detected: DetectedTaxId[],
): Promise<{ number: string } | null> {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;
  if (!Array.isArray(detected) || detected.length === 0) return null;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('tenants')
    .select('gst_number')
    .eq('id', tenant.id)
    .maybeSingle();
  // Already have one on file → never pester.
  if ((row?.gst_number as string | null)?.trim()) return null;

  const dismissed = await getDismissedNumbers(tenant.id);
  const match = detected.find(
    (d) =>
      d?.placement === 'sender' &&
      isValidGstNumber(d.number) &&
      !dismissed.has(normalizeGstNumber(d.number)) &&
      businessNameMatches(d.near_business_name, tenant.name),
  );
  return match ? { number: match.number } : null;
}

export async function saveTenantGstNumberAction(
  rawNumber: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };
  if (!isValidGstNumber(rawNumber)) {
    return { ok: false, error: "That doesn't look like a valid GST/HST number." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from('tenants')
    .update({ gst_number: normalizeGstNumber(rawNumber) })
    .eq('id', tenant.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Record a number the operator said isn't theirs / skipped, so we don't re-ask. */
export async function dismissGstNumberAction(rawNumber: string): Promise<{ ok: true }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: true };
  const current = await getDismissedNumbers(tenant.id);
  current.add(normalizeGstNumber(rawNumber));
  await updatePrefs(tenant.id, 'intake', { gst_dismissed_numbers: Array.from(current) });
  return { ok: true };
}
