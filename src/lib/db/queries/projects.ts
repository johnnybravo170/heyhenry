/**
 * Project queries that run through the RLS-aware Supabase server client.
 *
 * Tenant isolation is enforced by `current_tenant_id()` in the `projects` RLS
 * policies. We never filter on `tenant_id` in application code.
 *
 * Soft-delete: `projects.deleted_at` filters out deleted rows in all listers.
 */

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { LifecycleStage } from '@/lib/validators/project';

export type ProjectCustomerSummary = {
  id: string;
  name: string;
  /** Nullable: legacy customers (and contacts created via lead intake) may
   *  not have a categorical type set yet. Don't gate rendering on it. */
  type: 'residential' | 'commercial' | 'agent' | null;
  /** Job-site locale, surfaced under the project name on the list. Sourced
   *  from the customer's address (projects carry no address of their own). */
  city: string | null;
  province: string | null;
};

export type ProjectRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  name: string;
  description: string | null;
  lifecycle_stage: LifecycleStage;
  resumed_from_stage: LifecycleStage | null;
  management_fee_rate: number;
  /**
   * TRUE: cost-plus billing (labour + expenses + mgmt fee, with markup
   * applied to the contractor's pre-tax cost). FALSE: fixed-price (bill
   * the priced estimate / contract balance). See migration 0209 and
   * `generateFinalInvoiceAction` for path selection.
   */
  is_cost_plus: boolean;
  start_date: string | null;
  target_end_date: string | null;
  percent_complete: number;
  estimate_status: 'draft' | 'pending_approval' | 'approved' | 'declined';
  estimate_approval_code: string | null;
  estimate_sent_at: string | null;
  estimate_approved_at: string | null;
  estimate_approved_by_name: string | null;
  estimate_declined_at: string | null;
  estimate_declined_reason: string | null;
  estimate_approval_method: string | null;
  estimate_approved_by_member_id: string | null;
  estimate_approval_proof_paths: string[];
  estimate_approval_notes: string | null;
  /** Free-form terms / notes rendered at the bottom of the customer-facing estimate. */
  terms_text: string | null;
  /**
   * 'estimate' (default, non-binding ballpark) or 'quote' (fixed-price,
   * binding unless scope changes). Only affects the customer-facing
   * document heading + auto-default snippets; internal UX is identical.
   */
  document_type: 'estimate' | 'quote';
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectWithCustomer = ProjectRow & {
  customer: ProjectCustomerSummary | null;
};

export type BudgetCategorySummary = {
  id: string;
  name: string;
  section: string;
  description: string | null;
  estimate_cents: number;
  display_order: number;
  is_visible_in_report: boolean;
};

export type ProjectWithRelations = ProjectWithCustomer & {
  budget_categories: BudgetCategorySummary[];
};

export type ProjectListSort = 'name' | 'customer' | 'status' | 'start' | 'created';

export type ProjectListFilters = {
  /** Single-stage filter (legacy callers). */
  stage?: LifecycleStage;
  /** Multi-stage filter (the redesigned list). Takes precedence over `stage`. */
  stages?: LifecycleStage[];
  customer_id?: string;
  /** Free-text search over project name. Combine with `customerIds` for "name OR customer". */
  name?: string;
  /** Customer ids whose name matched the search term — OR'd with the name match. */
  customerIds?: string[];
  /** DB-backed sort column. Progress (% complete) is computed per-page, not sortable here. */
  sort?: ProjectListSort;
  dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export type LifecycleStageCounts = Record<LifecycleStage, number>;

const PROJECT_COLUMNS =
  'id, tenant_id, customer_id, name, description, lifecycle_stage, resumed_from_stage, management_fee_rate, is_cost_plus, start_date, target_end_date, percent_complete, estimate_status, estimate_approval_code, estimate_sent_at, estimate_approved_at, estimate_approved_by_name, estimate_declined_at, estimate_declined_reason, estimate_approval_method, estimate_approved_by_member_id, estimate_approval_proof_paths, estimate_approval_notes, terms_text, document_type, deleted_at, created_at, updated_at';

const PROJECT_WITH_CUSTOMER_SELECT = `${PROJECT_COLUMNS}, customers:customer_id (id, name, type, city, province)`;

function extractCustomer(raw: unknown): ProjectCustomerSummary | null {
  if (!raw) return null;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (!candidate || typeof candidate !== 'object') return null;
  const obj = candidate as Record<string, unknown>;
  // id + name are the load-bearing fields for rendering; type is
  // categorization that can be null on legacy/lead-intake-created customers.
  if (typeof obj.id !== 'string' || typeof obj.name !== 'string') return null;
  const type =
    obj.type === 'residential' || obj.type === 'commercial' || obj.type === 'agent'
      ? obj.type
      : null;
  return {
    id: obj.id,
    name: obj.name,
    type,
    city: typeof obj.city === 'string' ? obj.city : null,
    province: typeof obj.province === 'string' ? obj.province : null,
  };
}

function normalizeProject(row: Record<string, unknown>): ProjectWithCustomer {
  const { customers: customerRaw, ...rest } = row;
  return { ...(rest as ProjectRow), customer: extractCustomer(customerRaw) };
}

/** Escape PostgREST ilike wildcards so "%" / "_" in user input don't blow scope. */
function escapeIlike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Map a sort key to the projects column it orders by (DB-backed columns only). */
const SORT_COLUMN: Record<ProjectListSort, string> = {
  name: 'name',
  customer: 'created_at', // customer is a join; fall back to created (not server-sortable)
  status: 'created_at', // status is a filter, not a meaningful server sort
  start: 'start_date',
  created: 'created_at',
};

/** Shared filter application for listProjects + countProjects. */
function applyProjectListFilters<
  T extends {
    is: (col: string, value: null) => T;
    eq: (col: string, value: string) => T;
    in: (col: string, values: readonly string[]) => T;
    or: (expr: string) => T;
  },
>(query: T, filters: ProjectListFilters): T {
  let q = query.is('deleted_at', null);

  if (filters.stages && filters.stages.length > 0) {
    q = q.in('lifecycle_stage', filters.stages);
  } else if (filters.stage) {
    q = q.eq('lifecycle_stage', filters.stage);
  }
  if (filters.customer_id) q = q.eq('customer_id', filters.customer_id);

  const name = filters.name?.trim();
  if (name) {
    const needle = `%${escapeIlike(name)}%`;
    const ids = filters.customerIds ?? [];
    // "project name OR a customer whose name matched the term".
    q =
      ids.length > 0
        ? q.or(`name.ilike.${needle},customer_id.in.(${ids.join(',')})`)
        : q.or(`name.ilike.${needle}`);
  }
  return q;
}

export async function listProjects(
  filters: ProjectListFilters = {},
): Promise<ProjectWithCustomer[]> {
  const supabase = await createClient();
  const limit = filters.limit ?? 200;
  const offset = filters.offset ?? 0;
  const sortCol = SORT_COLUMN[filters.sort ?? 'created'];
  const ascending = (filters.dir ?? (filters.sort === 'name' ? 'asc' : 'desc')) === 'asc';

  let query = supabase.from('projects').select(PROJECT_WITH_CUSTOMER_SELECT);
  query = applyProjectListFilters(query, filters) as typeof query;

  const { data, error } = await query
    .order(sortCol, { ascending, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list projects: ${error.message}`);
  }
  return (data ?? []).map((row) => normalizeProject(row as Record<string, unknown>));
}

export async function countProjects(filters: ProjectListFilters = {}): Promise<number> {
  const supabase = await createClient();
  let query = supabase.from('projects').select('id', { count: 'exact', head: true });
  query = applyProjectListFilters(query, filters) as typeof query;
  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to count projects: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * Non-cached implementation. Exposed as `getProject` via a React.cache
 * wrapper below so generateMetadata + page + nested server components
 * in the same render dedupe to a single DB call.
 */
async function getProjectUncached(id: string): Promise<ProjectWithRelations | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('projects')
    .select(
      `${PROJECT_COLUMNS},
       customers:customer_id (id, name, type)`,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to load project: ${error.message}`);
  }
  if (!data) return null;

  const { customers: customerRaw, ...rest } = data as Record<string, unknown>;
  const base: ProjectRow = rest as ProjectRow;

  // Load budget categories
  const { data: categoryData, error: categoryErr } = await supabase
    .from('project_budget_categories')
    .select('id, name, section, description, estimate_cents, display_order, is_visible_in_report')
    .eq('project_id', id)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (categoryErr) {
    throw new Error(`Failed to load budget categories: ${categoryErr.message}`);
  }

  return {
    ...base,
    customer: extractCustomer(customerRaw),
    budget_categories: (categoryData ?? []) as BudgetCategorySummary[],
  };
}

/**
 * Per-request memoised project fetch. Same signature as the raw function,
 * but multiple calls within the same render (generateMetadata, page shell,
 * nested tab server components) coalesce to one DB hit.
 */
export const getProject = cache(getProjectUncached);

export async function countProjectsByLifecycleStage(): Promise<LifecycleStageCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('lifecycle_stage')
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to count projects: ${error.message}`);
  }

  const counts: LifecycleStageCounts = {
    planning: 0,
    awaiting_approval: 0,
    active: 0,
    on_hold: 0,
    declined: 0,
    complete: 0,
    cancelled: 0,
  };
  for (const row of data ?? []) {
    const s = (row as { lifecycle_stage?: string }).lifecycle_stage;
    if (s && s in counts) {
      counts[s as LifecycleStage] += 1;
    }
  }
  return counts;
}
