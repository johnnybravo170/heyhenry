'use server';

/**
 * GST/HST number suggestion on intake (cards 015406d5 + dc77f067).
 *
 * The parser records GST/HST numbers it sees on dropped docs
 * (`ParsedIntake.detected_tax_ids`: number + placement + nearby business name).
 * From a SENDER-block, validly-formatted, not-dismissed number this module
 * decides which of two offers to make:
 *  - OWNER: the business name matches THIS tenant and they have no number on
 *    file → offer to save it to their business profile (`tenants.gst_number`).
 *  - SUB: the business name is present but ISN'T the tenant's → it's an outside
 *    business that sent us a quote/bill → offer to add them as a contact
 *    (`kind='sub'`) and log the number on their card (`contacts.gst_number`).
 * The business-name match is the load-bearing gate that keeps a sub's number
 * off the tenant profile (and vice-versa).
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
 * What to offer the operator about a detected GST number:
 *  - `owner`: it's the operator's own number (letterhead matches the tenant) and
 *    they have none on file → offer to save it to their business profile.
 *  - `sub`: it's an outside business's number (sender block, name ≠ tenant) → it
 *    came in on a quote/bill, so offer to add them as a contact + log the number.
 * Pure read — no writes.
 */
export type GstSuggestion =
  | { kind: 'owner'; number: string }
  | { kind: 'sub'; number: string; businessName: string };

export async function evaluateGstSuggestionAction(
  detected: DetectedTaxId[],
): Promise<GstSuggestion | null> {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;
  if (!Array.isArray(detected) || detected.length === 0) return null;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('tenants')
    .select('gst_number')
    .eq('id', tenant.id)
    .maybeSingle();
  const tenantHasGst = Boolean((row?.gst_number as string | null)?.trim());

  const dismissed = await getDismissedNumbers(tenant.id);
  const candidates = detected.filter(
    (d) =>
      d?.placement === 'sender' &&
      isValidGstNumber(d.number) &&
      !dismissed.has(normalizeGstNumber(d.number)),
  );

  // Owner's own number — only worth offering when the profile is still empty.
  if (!tenantHasGst) {
    const own = candidates.find((d) => businessNameMatches(d.near_business_name, tenant.name));
    if (own) return { kind: 'owner', number: own.number };
  }

  // Otherwise, an outside business that sent us a doc (a sub / vendor): a sender
  // number with a real business name that ISN'T ours.
  const sub = candidates.find(
    (d) => d.near_business_name?.trim() && !businessNameMatches(d.near_business_name, tenant.name),
  );
  if (sub?.near_business_name) {
    return { kind: 'sub', number: sub.number, businessName: sub.near_business_name.trim() };
  }
  return null;
}

/**
 * Add (or update) a sub/vendor contact with a GST number detected on their
 * quote. Attaches to an existing contact if one matches by name + is missing a
 * number; otherwise creates a new `kind='sub'` contact.
 */
export async function saveSubContactGstAction(
  rawNumber: string,
  businessName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: 'Not signed in.' };
  const name = businessName.trim();
  if (!name) return { ok: false, error: 'Missing business name.' };
  if (!isValidGstNumber(rawNumber)) {
    return { ok: false, error: "That doesn't look like a valid GST/HST number." };
  }
  const gst = normalizeGstNumber(rawNumber);
  const admin = createAdminClient();

  // Attach to an existing sub/vendor contact of the same name if one exists.
  const { data: existing } = await admin
    .from('contacts')
    .select('id, gst_number')
    .eq('tenant_id', tenant.id)
    .in('kind', ['sub', 'vendor'])
    .ilike('name', name)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (!(existing.gst_number as string | null)?.trim()) {
      const { error } = await admin
        .from('contacts')
        .update({ gst_number: gst })
        .eq('id', existing.id);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const { error } = await admin
    .from('contacts')
    .insert({ tenant_id: tenant.id, kind: 'sub', name, gst_number: gst });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
