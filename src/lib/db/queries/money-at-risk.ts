/**
 * Money-at-Risk query — contacts the autopilot has flagged for owner
 * attention. Drives the dashboard card of the same name.
 *
 * "At risk" today means: a customer who got the full quote-followup sequence
 * (24h SMS + 48h email) and still hasn't responded. The T+72h step in the
 * system sequence tags them `needs_owner_attention`.
 */

import { NEEDS_OWNER_ATTENTION_TAG } from '@/lib/ar/system-sequences';
import { createAdminClient } from '@/lib/supabase/admin';

export type MoneyAtRiskRow = {
  /** ar_contacts.id — the AR-system contact this risk row was tagged on. */
  arContactId: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  /** contacts.id of the matched customer record (navigable to /contacts/[id]). */
  contactId: string | null;
  projectId: string | null;
  projectName: string | null;
  totalCents: number | null;
  taggedAt: string;
  daysSinceTagged: number;
};

export async function listMoneyAtRisk(tenantId: string): Promise<MoneyAtRiskRow[]> {
  const admin = createAdminClient();

  // Pull the tagged contacts. Join keys are simple enough to do this in one
  // query with the supabase REST shape — but we hop through ar_contacts
  // first since the tag table has no tenant_id of its own.
  const { data: tagged } = await admin
    .from('ar_contact_tags')
    .select(
      `tag, tagged_at,
       ar_contacts!inner (id, tenant_id, email, phone, first_name, last_name)`,
    )
    .eq('tag', NEEDS_OWNER_ATTENTION_TAG)
    .eq('ar_contacts.tenant_id', tenantId);

  if (!tagged || tagged.length === 0) return [];

  type RawRow = {
    tag: string;
    tagged_at: string;
    ar_contacts: {
      id: string;
      tenant_id: string;
      email: string | null;
      phone: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  };

  const rows = (tagged as unknown as RawRow[]).filter((r) => r.ar_contacts);

  // For each tagged contact, find the matching customer + most recent
  // pending-approval project. Best-effort: one batch by email, one by phone,
  // dedupe on customer id.
  const emails = rows
    .map((r) => r.ar_contacts?.email?.toLowerCase())
    .filter((v): v is string => !!v);
  const phones = rows.map((r) => r.ar_contacts?.phone).filter((v): v is string => !!v);

  const customerByContact = new Map<string, { id: string; name: string }>();

  // Resolve matching customers by email and phone in parallel (the two lookups
  // are independent), and index the tagged AR contacts by email/phone so each
  // match is O(1) instead of an O(n*m) rows.find() per returned customer. The
  // phone list preserves the original "first tagged contact not already matched"
  // semantics.
  const arByEmail = new Map<string, NonNullable<RawRow['ar_contacts']>>();
  const arByPhone = new Map<string, NonNullable<RawRow['ar_contacts']>[]>();
  for (const r of rows) {
    if (!r.ar_contacts) continue;
    const e = r.ar_contacts.email?.toLowerCase();
    if (e && !arByEmail.has(e)) arByEmail.set(e, r.ar_contacts);
    const p = r.ar_contacts.phone;
    if (p) {
      const arr = arByPhone.get(p) ?? [];
      arr.push(r.ar_contacts);
      arByPhone.set(p, arr);
    }
  }

  const [emailRes, phoneRes] = await Promise.all([
    emails.length > 0
      ? admin
          .from('contacts')
          .select('id, name, email')
          .eq('tenant_id', tenantId)
          .in('email', emails)
      : Promise.resolve({ data: [] as { id: string; name: string; email: string | null }[] }),
    phones.length > 0
      ? admin
          .from('contacts')
          .select('id, name, phone')
          .eq('tenant_id', tenantId)
          .in('phone', phones)
      : Promise.resolve({ data: [] as { id: string; name: string; phone: string | null }[] }),
  ]);

  for (const c of emailRes.data ?? []) {
    const row = c as { id: string; name: string; email: string | null };
    const contact = arByEmail.get(row.email?.toLowerCase() ?? '');
    if (contact) customerByContact.set(contact.id, { id: row.id, name: row.name });
  }
  for (const c of phoneRes.data ?? []) {
    const row = c as { id: string; name: string; phone: string | null };
    if (!row.phone) continue;
    const contact = (arByPhone.get(row.phone) ?? []).find((ar) => !customerByContact.has(ar.id));
    if (contact) customerByContact.set(contact.id, { id: row.id, name: row.name });
  }

  // For each customer, fetch the most recent pending-approval project.
  const contactIds = Array.from(new Set(Array.from(customerByContact.values()).map((c) => c.id)));
  const projectByCustomer = new Map<string, { id: string; name: string; totalCents: number }>();

  if (contactIds.length > 0) {
    const { data: projects } = await admin
      .from('projects')
      .select('id, name, contact_id, estimate_sent_at')
      .in('contact_id', contactIds)
      .eq('estimate_status', 'pending_approval')
      .is('deleted_at', null)
      .order('estimate_sent_at', { ascending: false });

    // Pick the most-recent per customer + sum cost lines for the total.
    const seenCustomers = new Set<string>();
    const projectsToTotal: { id: string; contactId: string; name: string }[] = [];
    for (const p of (projects ?? []) as Array<{ id: string; name: string; contact_id: string }>) {
      if (seenCustomers.has(p.contact_id)) continue;
      seenCustomers.add(p.contact_id);
      projectsToTotal.push({ id: p.id, contactId: p.contact_id, name: p.name });
    }
    if (projectsToTotal.length > 0) {
      const projIds = projectsToTotal.map((p) => p.id);
      const { data: lines } = await admin
        .from('project_cost_lines')
        .select('project_id, line_price_cents')
        .in('project_id', projIds);
      const totalByProject = new Map<string, number>();
      for (const l of (lines ?? []) as Array<{ project_id: string; line_price_cents: number }>) {
        totalByProject.set(
          l.project_id,
          (totalByProject.get(l.project_id) ?? 0) + (l.line_price_cents ?? 0),
        );
      }
      for (const p of projectsToTotal) {
        projectByCustomer.set(p.contactId, {
          id: p.id,
          name: p.name,
          totalCents: totalByProject.get(p.id) ?? 0,
        });
      }
    }
  }

  return rows
    .map((r) => {
      const c = r.ar_contacts;
      if (!c) return null;
      const linked = customerByContact.get(c.id) ?? null;
      const project = linked ? (projectByCustomer.get(linked.id) ?? null) : null;
      const fullName =
        [c.first_name, c.last_name].filter(Boolean).join(' ').trim() ||
        linked?.name ||
        c.email ||
        c.phone ||
        'Unknown contact';
      const taggedAt = r.tagged_at;
      const daysSinceTagged = Math.floor(
        (Date.now() - new Date(taggedAt).getTime()) / (24 * 60 * 60 * 1000),
      );
      return {
        arContactId: c.id,
        contactName: fullName,
        contactEmail: c.email,
        contactPhone: c.phone,
        contactId: linked?.id ?? null,
        projectId: project?.id ?? null,
        projectName: project?.name ?? null,
        totalCents: project?.totalCents ?? null,
        taggedAt,
        daysSinceTagged,
      } satisfies MoneyAtRiskRow;
    })
    .filter((r): r is MoneyAtRiskRow => r !== null)
    .sort((a, b) => (b.totalCents ?? 0) - (a.totalCents ?? 0));
}
