/**
 * Overhead expense queries — operating expenses not tied to any project.
 *
 * As of the cost-unification rollout these read from the unified
 * `project_costs` table filtered to `source_type='receipt'` (overhead
 * expenses don't have a vendor-bill counterpart). The output shape
 * keeps using `expense_date` / `receipt_storage_path` / `tax_cents` —
 * remapped from `cost_date` / `attachment_storage_path` / `gst_cents`
 * on the way out so callers don't shift.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const RECEIPT_URL_TTL_SECONDS = 60 * 60; // 1h — matches edit-page convention

export type OverheadExpenseRow = {
  id: string;
  expense_date: string;
  amount_cents: number;
  tax_cents: number;
  vendor: string | null;
  description: string | null;
  /** Null for overhead; populated when includeProjectExpenses is true. */
  project_id: string | null;
  receipt_storage_path: string | null;
  /** Signed URL for the receipt (1hr TTL), or null if no receipt attached. */
  receipt_signed_url: string | null;
  /** Mime type hint for the preview (image/* renders inline, pdf gets an icon). */
  receipt_mime_hint: 'image' | 'pdf' | null;
  category_id: string | null;
  category_name: string | null;
  parent_category_name: string | null;
  /** Snapshot of how this expense was paid for. Pulled from payment_sources
   *  via FK; null when the row is legacy or the source was hard-deleted. */
  payment_source: {
    id: string;
    label: string;
    last4: string | null;
    paid_by: 'business' | 'personal_reimbursable' | 'petty_cash';
    kind: 'debit' | 'credit' | 'cash' | 'etransfer' | 'cheque' | 'other';
  } | null;
  card_last4: string | null;
};

export async function listOverheadExpenses(opts?: {
  from?: string;
  to?: string;
  categoryId?: string;
  /** Include project-linked expenses too (bookkeeper view). */
  includeProjectExpenses?: boolean;
  /** Filter to only uncategorized rows (bookkeeper triage view). */
  uncategorizedOnly?: boolean;
}): Promise<OverheadExpenseRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from('project_costs')
    .select(
      'id, cost_date, amount_cents, gst_cents, vendor, description, attachment_storage_path, project_id, category_id, card_last4, categories:category_id (name, parent:parent_id (name)), payment_source:payment_source_id (id, label, last4, paid_by, kind)',
    )
    .eq('source_type', 'receipt')
    .eq('status', 'active')
    .order('cost_date', { ascending: false });

  if (!opts?.includeProjectExpenses) {
    query = query.is('project_id', null);
  }
  if (opts?.uncategorizedOnly) {
    query = query.is('category_id', null);
  }

  if (opts?.from) query = query.gte('cost_date', opts.from);
  if (opts?.to) query = query.lte('cost_date', opts.to);
  if (opts?.categoryId) query = query.eq('category_id', opts.categoryId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list overhead expenses: ${error.message}`);

  // Batch-sign receipt URLs so the list can hover-preview without a
  // per-row round-trip. Admin client because the `receipts` bucket RLS
  // checks auth.uid() against a tenant_members lookup and storage RLS
  // is flaky from the list render path (same reason cost-line thumbs
  // use admin). One createSignedUrls call for all paths.
  const receiptPaths = (data ?? [])
    .map((r) => (r as { attachment_storage_path?: string | null }).attachment_storage_path ?? null)
    .filter((p): p is string => !!p);

  const urlByPath = new Map<string, string>();
  if (receiptPaths.length > 0) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from('receipts')
      .createSignedUrls(receiptPaths, RECEIPT_URL_TTL_SECONDS);
    for (const row of signed ?? []) {
      if (row.path && row.signedUrl) urlByPath.set(row.path, row.signedUrl);
    }
  }

  return (data ?? []).map((row) => mapExpenseRow(row, urlByPath));
}

// ---------------------------------------------------------------------------
// Paginated + filtered ledger (the owner-facing /expenses surface).
//
// The legacy `listOverheadExpenses` above renders the WHOLE table unbounded —
// fine for the bookkeeper triage twin, a real perf + scannability gap on the
// owner ledger as the year fills in. This variant pushes filtering, search,
// and pagination into Postgres (`.range()` + an exact head count) so the page
// never materializes more than one page of rows.
// ---------------------------------------------------------------------------

export type OverheadLedgerFilters = {
  from?: string;
  to?: string;
  categoryId?: string;
  /** Match on the snapshotted vendor string (exact, from the facet list). */
  vendor?: string;
  paymentSourceId?: string;
  uncategorizedOnly?: boolean;
  /** Free-text over vendor + description (case-insensitive). */
  search?: string;
};

export type OverheadLedgerPage = {
  rows: OverheadExpenseRow[];
  /** Total rows matching the filters (across all pages). */
  total: number;
  page: number;
  pageSize: number;
  /** Sum of amount/tax across ALL matching rows, not just this page. */
  summary: { amount_cents: number; tax_cents: number; uncategorized_count: number };
  /** Distinct facet values for the filter selects (unfiltered by period/search). */
  facets: { vendors: string[] };
};

export const OVERHEAD_LEDGER_PAGE_SIZE = 25;

// biome-ignore lint/suspicious/noExplicitAny: the Supabase query builder type isn't generic-friendly across .select() shapes
function applyLedgerFilters(query: any, filters: OverheadLedgerFilters): any {
  let q = query;
  if (filters.uncategorizedOnly) q = q.is('category_id', null);
  if (filters.from) q = q.gte('cost_date', filters.from);
  if (filters.to) q = q.lte('cost_date', filters.to);
  if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
  if (filters.vendor) q = q.eq('vendor', filters.vendor);
  if (filters.paymentSourceId) q = q.eq('payment_source_id', filters.paymentSourceId);
  if (filters.search) {
    // Escape PostgREST `or` filter metacharacters then ILIKE both fields.
    const term = filters.search.replace(/[%,()]/g, '').trim();
    if (term) q = q.or(`vendor.ilike.%${term}%,description.ilike.%${term}%`);
  }
  return q;
}

export async function listOverheadExpensesPage(
  filters: OverheadLedgerFilters,
  page: number,
  pageSize: number = OVERHEAD_LEDGER_PAGE_SIZE,
): Promise<OverheadLedgerPage> {
  const supabase = await createClient();
  const safePage = Math.max(1, Math.floor(page) || 1);
  const fromIdx = (safePage - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  const baseSelect =
    'id, cost_date, amount_cents, gst_cents, vendor, description, attachment_storage_path, project_id, category_id, card_last4, categories:category_id (name, parent:parent_id (name)), payment_source:payment_source_id (id, label, last4, paid_by, kind)';

  // Page of rows (overhead only — project_id IS NULL is the /expenses slice).
  const rowsQuery = applyLedgerFilters(
    supabase
      .from('project_costs')
      .select(baseSelect)
      .eq('source_type', 'receipt')
      .eq('status', 'active')
      .is('project_id', null),
    filters,
  )
    .order('cost_date', { ascending: false })
    .range(fromIdx, toIdx);

  // Count + summary across ALL matching rows. We pull (amount, gst,
  // category) for the matching set to total accurately — the ledger is the
  // non-project slice so this stays a bounded scan, and the summary strip
  // needs the full-period figure, not the page's.
  const summaryQuery = applyLedgerFilters(
    supabase
      .from('project_costs')
      .select('amount_cents, gst_cents, category_id', { count: 'exact' })
      .eq('source_type', 'receipt')
      .eq('status', 'active')
      .is('project_id', null),
    filters,
  );

  // Vendor facet — distinct non-null vendors on the whole overhead slice,
  // independent of the active filters so the picker never hides an option
  // the current filter happens to exclude.
  const vendorFacetQuery = supabase
    .from('project_costs')
    .select('vendor')
    .eq('source_type', 'receipt')
    .eq('status', 'active')
    .is('project_id', null)
    .not('vendor', 'is', null)
    .order('vendor', { ascending: true });

  const [rowsRes, summaryRes, vendorRes] = await Promise.all([
    rowsQuery,
    summaryQuery,
    vendorFacetQuery,
  ]);

  if (rowsRes.error) throw new Error(`Failed to list overhead expenses: ${rowsRes.error.message}`);
  if (summaryRes.error)
    throw new Error(`Failed to total overhead expenses: ${summaryRes.error.message}`);

  const data = (rowsRes.data ?? []) as Array<Record<string, unknown>>;

  const receiptPaths = data
    .map((r) => (r as { attachment_storage_path?: string | null }).attachment_storage_path ?? null)
    .filter((p): p is string => !!p);
  const urlByPath = new Map<string, string>();
  if (receiptPaths.length > 0) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from('receipts')
      .createSignedUrls(receiptPaths, RECEIPT_URL_TTL_SECONDS);
    for (const row of signed ?? []) {
      if (row.path && row.signedUrl) urlByPath.set(row.path, row.signedUrl);
    }
  }

  const summaryRows = (summaryRes.data ?? []) as Array<{
    amount_cents: number;
    gst_cents: number | null;
    category_id: string | null;
  }>;
  const summary = summaryRows.reduce(
    (acc, r) => {
      acc.amount_cents += r.amount_cents ?? 0;
      acc.tax_cents += r.gst_cents ?? 0;
      if (!r.category_id) acc.uncategorized_count += 1;
      return acc;
    },
    { amount_cents: 0, tax_cents: 0, uncategorized_count: 0 },
  );

  const vendors = Array.from(
    new Set(
      ((vendorRes.data ?? []) as Array<{ vendor: string | null }>)
        .map((r) => r.vendor)
        .filter((v): v is string => !!v && v.trim().length > 0),
    ),
  );

  return {
    rows: data.map((row) => mapExpenseRow(row, urlByPath)),
    total: summaryRes.count ?? summaryRows.length,
    page: safePage,
    pageSize,
    summary,
    facets: { vendors },
  };
}

// Shared row → OverheadExpenseRow mapper (used by both list variants).
function mapExpenseRow(
  row: Record<string, unknown>,
  urlByPath: Map<string, string>,
): OverheadExpenseRow {
  const catRaw = (row as Record<string, unknown>).categories as
    | { name?: string; parent?: { name?: string } | { name?: string }[] | null }
    | { name?: string; parent?: { name?: string } | { name?: string }[] | null }[]
    | null;
  const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
  const parentRaw = cat?.parent;
  const parent = Array.isArray(parentRaw) ? parentRaw[0] : parentRaw;
  const receiptPath =
    ((row as { attachment_storage_path?: string | null }).attachment_storage_path as
      | string
      | null) ?? null;
  const isPdf = receiptPath?.toLowerCase().endsWith('.pdf') ?? false;

  type RawSource = {
    id?: string;
    label?: string;
    last4?: string | null;
    paid_by?: OverheadExpenseRow['payment_source'] extends infer T
      ? T extends { paid_by: infer P }
        ? P
        : never
      : never;
    kind?: OverheadExpenseRow['payment_source'] extends infer T
      ? T extends { kind: infer K }
        ? K
        : never
      : never;
  };
  const sourceRaw = (row as Record<string, unknown>).payment_source as
    | RawSource
    | RawSource[]
    | null
    | undefined;
  const source = Array.isArray(sourceRaw) ? sourceRaw[0] : sourceRaw;
  const paymentSource: OverheadExpenseRow['payment_source'] =
    source?.id && source.label && source.paid_by && source.kind
      ? {
          id: source.id,
          label: source.label,
          last4: source.last4 ?? null,
          paid_by: source.paid_by,
          kind: source.kind,
        }
      : null;

  return {
    id: row.id as string,
    expense_date: (row as { cost_date: string }).cost_date,
    amount_cents: row.amount_cents as number,
    tax_cents: ((row as { gst_cents?: number }).gst_cents as number) ?? 0,
    vendor: (row.vendor as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    project_id: (row.project_id as string | null) ?? null,
    receipt_storage_path: receiptPath,
    receipt_signed_url: receiptPath ? (urlByPath.get(receiptPath) ?? null) : null,
    receipt_mime_hint: receiptPath ? (isPdf ? 'pdf' : 'image') : null,
    category_id: (row.category_id as string | null) ?? null,
    category_name: (cat?.name as string | undefined) ?? null,
    parent_category_name: (parent?.name as string | undefined) ?? null,
    payment_source: paymentSource,
    card_last4: (row.card_last4 as string | null) ?? null,
  };
}
