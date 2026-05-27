/**
 * Customer queries that run through the RLS-aware Supabase server client.
 *
 * These helpers never pass the admin/service-role client — tenant isolation
 * is enforced by `current_tenant_id()` on every `customers` policy (see
 * migrations 0016_all_rls_policies.sql). That means we don't filter on
 * `tenant_id` in application code either; doing so would be redundant and
 * hide RLS failures.
 *
 * Soft-delete: `customers.deleted_at` is added in 0018. All listers skip
 * soft-deleted rows. `getCustomer` optionally includes them for admin UX.
 */

import { type ArInvoice, arOutstanding } from '@/lib/invoices/ar';
import { phoneDigits } from '@/lib/phone';
import { createClient } from '@/lib/supabase/server';

export type CustomerRow = {
  id: string;
  tenant_id: string;
  /** New kind column (Slice A). Present on every row. */
  kind: 'lead' | 'customer' | 'vendor' | 'sub' | 'agent' | 'inspector' | 'referral' | 'other';
  /**
   * Legacy subtype field. For backwards-compat the query layer synthesizes
   * 'agent' here when `kind='agent'`, and for other non-customer kinds
   * falls back to 'residential'. Callers that care about the real model
   * should branch on `kind` first.
   */
  type: 'residential' | 'commercial' | 'agent';
  name: string;
  email: string | null;
  /** Extra recipients for customer-facing emails. Always returned as an
   *  array — the column has NOT NULL DEFAULT '{}'. */
  additional_emails: string[];
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  notes: string | null;
  do_not_auto_message: boolean;
  do_not_auto_message_at: string | null;
  do_not_auto_message_source: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type RelatedQuote = {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
};

export type RelatedJob = {
  id: string;
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type RelatedInvoice = {
  id: string;
  status: string;
  amount_cents: number;
  tax_cents: number;
  tax_inclusive: boolean;
  line_items: { total_cents: number | null }[] | null;
  created_at: string;
};

export type CustomerListFilters = {
  search?: string;
  /**
   * Legacy subtype filter (residential/commercial/agent). Treated as a kind
   * filter when set to 'agent'; otherwise as a customer-subtype filter.
   */
  type?: 'residential' | 'commercial' | 'agent';
  /** New kind-first filter. Takes precedence over `type` when both are set. */
  kind?: 'lead' | 'customer' | 'vendor' | 'sub' | 'agent' | 'inspector' | 'referral' | 'other';
  /** Restrict to a specific set of contact ids (drives the dedupe `?dupes` review). */
  ids?: string[];
  limit?: number;
  offset?: number;
};

const CUSTOMER_COLUMNS =
  'id, tenant_id, kind, type, name, email, additional_emails, phone, address_line1, city, province, postal_code, notes, do_not_auto_message, do_not_auto_message_at, do_not_auto_message_source, created_at, updated_at, deleted_at';

/**
 * For the duration of the contacts-unification rollout (Slice A), readers
 * still expect a flat `type` field with legacy values (residential |
 * commercial | agent). Map the persisted `kind` + `type` pair onto that
 * surface: agent rows now carry `kind='agent', type=NULL` in the DB, so we
 * synthesize 'agent' here. Non-customer/agent kinds (vendor, sub, etc.)
 * are not produced by the existing UI yet, but we return their `kind`
 * string so nothing dies if one shows up.
 */
function synthesizeLegacyType(row: {
  kind?: string | null;
  type?: string | null;
}): 'residential' | 'commercial' | 'agent' {
  if (row.kind === 'agent') return 'agent';
  if (row.type === 'residential' || row.type === 'commercial') return row.type;
  // Fallback — callers treat it as a customer subtype. Safe default for rollout.
  return 'residential';
}

/**
 * Escape a search term for use in `ilike` / `or` filters. Supabase expects
 * commas to be escaped inside `or(...)` and percent/underscore are `LIKE`
 * wildcards we want to take literally.
 */
function escapeForOr(term: string) {
  return term.replace(/[\\%,()]/g, '\\$&');
}

/**
 * Build the base SELECT query with soft-delete and optional search/type
 * filters applied. The RLS policy handles tenant scoping — do not add a
 * `.eq('tenant_id', …)` here.
 */
function applyListFilters<
  T extends {
    is: (col: string, value: null) => T;
    eq: (col: string, value: string) => T;
    in: (col: string, values: readonly string[]) => T;
    or: (expr: string) => T;
  },
>(query: T, filters: CustomerListFilters): T {
  let q = query.is('deleted_at', null);
  if (filters.ids) {
    // Empty set → match nothing (don't silently return the whole list).
    q = q.in('id', filters.ids.length > 0 ? filters.ids : ['00000000-0000-0000-0000-000000000000']);
  }
  if (filters.kind) {
    // Kind-first filter (Slice C). May be combined with a customer subtype
    // via `type` when `kind === 'customer'`.
    q = q.eq('kind', filters.kind);
    if (
      filters.kind === 'customer' &&
      (filters.type === 'residential' || filters.type === 'commercial')
    ) {
      q = q.eq('type', filters.type);
    }
  } else if (filters.type === 'agent') {
    // Legacy filter: agent rows now live under `kind='agent'` (type is NULL).
    q = q.eq('kind', 'agent');
  } else if (filters.type) {
    // Legacy residential / commercial filter — constrain to kind='customer'
    // so vendor/sub/etc. don't leak in.
    q = q.eq('kind', 'customer').eq('type', filters.type);
  }

  const search = filters.search?.trim();
  if (search) {
    const needle = `%${escapeForOr(search)}%`;
    const clauses = [
      `name.ilike.${needle}`,
      `email.ilike.${needle}`,
      `phone.ilike.${needle}`,
      `city.ilike.${needle}`,
    ];
    // Phones are stored canonical (E.164), so a formatted query like
    // "604-555" won't substring-match. Also match on the query's bare digits.
    const digits = phoneDigits(search);
    if (digits.length >= 3) clauses.push(`phone.ilike.%${digits}%`);
    q = q.or(clauses.join(','));
  }
  return q;
}

export async function listContacts(filters: CustomerListFilters = {}): Promise<CustomerRow[]> {
  const supabase = await createClient();
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  let query = supabase.from('contacts').select(CUSTOMER_COLUMNS);
  query = applyListFilters(query, filters) as typeof query;

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list contacts: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    ...(row as unknown as CustomerRow),
    type: synthesizeLegacyType(row as { kind?: string | null; type?: string | null }),
  })) as CustomerRow[];
}

/** One cluster of likely-duplicate contacts (shared name, email, or phone). */
export type DuplicateContactGroup = {
  /** Representative display name for the cluster. */
  name: string;
  /** Distinct kinds present in the cluster, e.g. ['lead','vendor']. */
  kinds: string[];
  ids: string[];
};

export type DuplicateContactsResult = {
  groups: DuplicateContactGroup[];
  totalGroups: number;
  /** Every contact id across all clusters — drives the `?dupes` review filter. */
  ids: string[];
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Detect likely-duplicate contacts for the current tenant: contacts that share
 * a normalized name, email, or phone are clustered (union-find over the three
 * signals, transitive). Returns clusters of size ≥ 2, biggest first. Powers the
 * Henry "possible duplicates" banner + the `?dupes` review view on /contacts.
 *
 * Bounded by the tenant's contact count (one lightweight read). RLS scopes it.
 */
export async function findDuplicateContacts(): Promise<DuplicateContactsResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('id, kind, name, email, phone')
    .is('deleted_at', null);
  if (error) throw new Error(`Failed to scan contacts for duplicates: ${error.message}`);

  type Row = {
    id: string;
    kind: string | null;
    name: string;
    email: string | null;
    phone: string | null;
  };
  const rows = (data ?? []) as Row[];

  // Union-find over contact indices.
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) {
      const next = parent[i];
      parent[i] = r;
      i = next;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // Link contacts sharing each signal value.
  const linkBy = (keyOf: (r: Row) => string | null) => {
    const firstSeen = new Map<string, number>();
    rows.forEach((r, i) => {
      const key = keyOf(r);
      if (!key) return;
      const seen = firstSeen.get(key);
      if (seen === undefined) firstSeen.set(key, i);
      else union(seen, i);
    });
  };
  linkBy((r) => (r.name ? normalizeName(r.name) : null));
  linkBy((r) => (r.email ? r.email.trim().toLowerCase() || null : null));
  linkBy((r) => {
    const d = r.phone ? phoneDigits(r.phone) : '';
    return d.length >= 7 ? d : null; // ignore too-short fragments
  });

  // Gather clusters.
  const clusters = new Map<number, number[]>();
  rows.forEach((_, i) => {
    const root = find(i);
    const arr = clusters.get(root);
    if (arr) arr.push(i);
    else clusters.set(root, [i]);
  });

  const groups: DuplicateContactGroup[] = [];
  for (const members of clusters.values()) {
    if (members.length < 2) continue;
    const memberRows = members.map((i) => rows[i]);
    const kinds = Array.from(new Set(memberRows.map((r) => r.kind ?? 'other')));
    const name = memberRows.find((r) => r.name?.trim())?.name ?? 'Unnamed';
    groups.push({ name, kinds, ids: memberRows.map((r) => r.id) });
  }
  groups.sort((a, b) => b.ids.length - a.ids.length);

  return {
    groups,
    totalGroups: groups.length,
    ids: groups.flatMap((g) => g.ids),
  };
}

export async function countCustomers(filters: CustomerListFilters = {}): Promise<number> {
  const supabase = await createClient();
  let query = supabase.from('contacts').select('id', { count: 'exact', head: true });
  query = applyListFilters(query, filters) as typeof query;

  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to count contacts: ${error.message}`);
  }
  return count ?? 0;
}

export type ContactKindCounts = Record<CustomerRow['kind'], number> & { all: number };

/**
 * Per-kind contact tallies for the directory filter chips. One pass over the
 * tenant's kind column (mirrors countProjectsByLifecycleStage). RLS scopes it.
 */
export async function countCustomersByKind(): Promise<ContactKindCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('contacts').select('kind').is('deleted_at', null);
  if (error) {
    throw new Error(`Failed to count customers by kind: ${error.message}`);
  }
  const counts: ContactKindCounts = {
    all: 0,
    lead: 0,
    customer: 0,
    vendor: 0,
    sub: 0,
    agent: 0,
    inspector: 0,
    referral: 0,
    other: 0,
  };
  for (const row of data ?? []) {
    const k = (row as { kind?: CustomerRow['kind'] }).kind;
    if (k && k in counts) counts[k] += 1;
    counts.all += 1;
  }
  return counts;
}

export async function getCustomer(id: string): Promise<CustomerRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .select(CUSTOMER_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    // `maybeSingle` returns an error when the row is missing on some
    // client versions; treat PGRST116 as "not found".
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to load customer: ${error.message}`);
  }
  if (!data) return null;
  return {
    ...(data as unknown as CustomerRow),
    type: synthesizeLegacyType(data as { kind?: string | null; type?: string | null }),
  } as CustomerRow;
}

export type CustomerRelated = {
  quotes: RelatedQuote[];
  jobs: RelatedJob[];
  invoices: RelatedInvoice[];
};

/**
 * Per-row directory signal — answers "does this contact matter right now?"
 *
 *  - `activeProjects` — count of non-terminal projects (the GC's live work).
 *  - `totalProjects` — any project at all; 0 ⇒ the contact is a lead
 *    ("jobs are gravity"; migration 0113).
 *  - `arDueCents` — outstanding receivable, tax-aware via the canonical AR
 *    helper. `null` when money is hidden (member role) so the UI never has a
 *    figure to leak.
 */
export type ContactSignal = {
  activeProjects: number;
  totalProjects: number;
  arDueCents: number | null;
};

/** A directory row enriched with its computed signal — what the list renders. */
export type ContactRow = CustomerRow & { signal: ContactSignal };

/** Project lifecycle stages that count as "live work" for the directory signal. */
const ACTIVE_PROJECT_STAGES = ['planning', 'awaiting_approval', 'active', 'on_hold'];

/**
 * Compute the directory signal for a set of contacts in one round-trip each
 * for projects and (when money is visible) outstanding invoices. Intended to
 * run for the **visible page only** — pass the page's customer IDs, not the
 * whole roster. RLS scopes both queries to the tenant.
 */
export async function getContactSignals(
  contactIds: string[],
  options: { includeMoney: boolean },
): Promise<Map<string, ContactSignal>> {
  const signals = new Map<string, ContactSignal>();
  if (contactIds.length === 0) return signals;
  for (const id of contactIds) {
    signals.set(id, {
      activeProjects: 0,
      totalProjects: 0,
      arDueCents: options.includeMoney ? 0 : null,
    });
  }

  const supabase = await createClient();

  const projectsRes = await supabase
    .from('projects')
    .select('contact_id, lifecycle_stage')
    .in('contact_id', contactIds)
    .is('deleted_at', null);
  if (projectsRes.error) {
    throw new Error(`Failed to load contact project signals: ${projectsRes.error.message}`);
  }
  for (const row of (projectsRes.data ?? []) as {
    contact_id: string | null;
    lifecycle_stage: string | null;
  }[]) {
    if (!row.contact_id) continue;
    const sig = signals.get(row.contact_id);
    if (!sig) continue;
    sig.totalProjects += 1;
    if (row.lifecycle_stage && ACTIVE_PROJECT_STAGES.includes(row.lifecycle_stage)) {
      sig.activeProjects += 1;
    }
  }

  if (options.includeMoney) {
    const invoicesRes = await supabase
      .from('invoices')
      .select(
        'contact_id, status, paid_at, deleted_at, sent_at, amount_cents, tax_cents, tax_inclusive, line_items',
      )
      .in('contact_id', contactIds)
      .eq('status', 'sent')
      .is('paid_at', null)
      .is('deleted_at', null);
    if (invoicesRes.error) {
      throw new Error(`Failed to load contact AR signals: ${invoicesRes.error.message}`);
    }
    const byCustomer = new Map<string, ArInvoice[]>();
    for (const row of (invoicesRes.data ?? []) as ({ contact_id: string | null } & ArInvoice)[]) {
      if (!row.contact_id) continue;
      const list = byCustomer.get(row.contact_id) ?? [];
      list.push(row);
      byCustomer.set(row.contact_id, list);
    }
    for (const [contactId, invoices] of byCustomer) {
      const sig = signals.get(contactId);
      if (sig) sig.arDueCents = arOutstanding(invoices);
    }
  }

  return signals;
}

export async function getCustomerRelated(id: string): Promise<CustomerRelated> {
  const supabase = await createClient();

  const [quotesRes, jobsRes, invoicesRes] = await Promise.all([
    supabase
      .from('quotes')
      .select('id, status, total_cents, created_at')
      .eq('contact_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('jobs')
      .select('id, status, scheduled_at, completed_at, created_at')
      .eq('contact_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('invoices')
      .select('id, status, amount_cents, tax_cents, tax_inclusive, line_items, created_at')
      .eq('contact_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (quotesRes.error) {
    throw new Error(`Failed to load related quotes: ${quotesRes.error.message}`);
  }
  if (jobsRes.error) {
    throw new Error(`Failed to load related jobs: ${jobsRes.error.message}`);
  }
  if (invoicesRes.error) {
    throw new Error(`Failed to load related invoices: ${invoicesRes.error.message}`);
  }

  return {
    quotes: (quotesRes.data ?? []) as RelatedQuote[],
    jobs: (jobsRes.data ?? []) as RelatedJob[],
    invoices: (invoicesRes.data ?? []) as RelatedInvoice[],
  };
}
