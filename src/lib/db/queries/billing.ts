/**
 * Billing / AR data layer — the project-grouped get-paid cockpit (GC verticals).
 *
 * A reno GC thinks in *projects and draw schedules*, not invoice documents:
 * what's the contract, what have I billed, what have they paid, what's left
 * to bill, what's overdue. This module rolls every invoice up under its
 * project (`invoices.project_id`) and computes that billing position, plus the
 * three cockpit numbers (Ready to bill · Outstanding · Overdue).
 *
 * Scope: this is the GC (renovation / tile) surface — everything hangs off
 * projects + draws. Invoices with no `project_id` (the job-based model used by
 * the pressure-washing vertical) are NOT this screen's concern; that vertical
 * keeps the flat invoice list. We simply ignore project-less invoices here so
 * the GC path stays purely project-grained.
 *
 * Money truth: Outstanding / Overdue / Billed / Paid all flow through the
 * canonical AR helpers in `@/lib/invoices/ar` + `invoiceTotalCents`. We do
 * NOT re-derive a fourth definition here (see invoices.md brief).
 *
 * Contract = latest signed scope-version total + Σ approved change orders not
 * already folded into a snapshot version. Ready to bill (v1) = an active/
 * complete project with remaining-to-bill (contract − billed) > 0 and nothing
 * overdue. Earned-value is a later refinement.
 *
 * Tenant isolation is enforced by RLS on every table touched. The whole
 * screen is built from a handful of batched `.in(...)` queries — no N+1.
 */

import { type ArInvoice, invoiceOutstandingCents, isOverdue } from '@/lib/invoices/ar';
import { invoiceTotalCents } from '@/lib/invoices/totals';
import { createClient } from '@/lib/supabase/server';
import type { InvoiceStatus } from '@/lib/validators/invoice';
import type { LifecycleStage } from '@/lib/validators/project';

/** A single draw / invoice inside an expanded project row. */
export type BillingInvoice = {
  id: string;
  doc_type: 'invoice' | 'draw';
  status: InvoiceStatus;
  /** Customer-facing total (tax-aware). */
  total_cents: number;
  tax_cents: number;
  tax_inclusive: boolean;
  sent_at: string | null;
  paid_at: string | null;
  payment_method: string | null;
  /** Outstanding AND aged past AR_OVERDUE_DAYS. */
  is_overdue: boolean;
  /** Whole days since sent, only meaningful when `is_overdue`. */
  overdue_days: number;
};

/** One project's billing position + its draws/invoices. */
export type BillingProjectPosition = {
  project_id: string;
  project_name: string;
  lifecycle_stage: LifecycleStage;
  customer: { id: string; name: string } | null;
  /** Job-site locale ("Chilliwack · BC") from the customer address; under the
   *  customer name on the row. Null when no address on file. */
  region: string | null;
  /** Latest signed version total + un-snapshotted approved COs; null when no
   *  signed scope version exists yet. */
  contract_cents: number | null;
  /** Σ totals of sent + paid invoices (money that has gone out). */
  billed_cents: number;
  /** Σ totals of paid invoices. */
  paid_cents: number;
  /** Σ outstanding (sent, unpaid) totals — canonical AR. */
  outstanding_cents: number;
  /** contract − billed, when contract is known; else null. */
  remaining_cents: number | null;
  overdue_count: number;
  overdue_cents: number;
  /** Age of the oldest overdue invoice, in days (0 when none overdue). */
  max_overdue_days: number;
  /** Active/complete project with remaining-to-bill > 0 — the billing prompt. */
  ready_to_bill: boolean;
  /** Dollar prompt for ready-to-bill = remaining-to-bill (0 when unknown). */
  ready_to_bill_cents: number;
  invoices: BillingInvoice[];
};

/** The three actionable cockpit numbers + their sublines (owner/admin only). */
export type BillingCockpit = {
  ready_to_bill_cents: number;
  /** Projects with remaining-to-bill (the ready-to-bill prompt count). */
  ready_project_count: number;
  outstanding_cents: number;
  /** Count of outstanding (sent, unpaid) invoices. */
  outstanding_count: number;
  /** Distinct projects carrying outstanding money. */
  outstanding_project_count: number;
  overdue_cents: number;
  /** Count of overdue invoices. */
  overdue_count: number;
  /** Age of the single oldest overdue invoice, in days. */
  overdue_max_days: number;
};

/** Filter-bar chip counts (by invoice; overdue is the aged subset of sent). */
export type BillingStatusCounts = {
  all: number;
  draft: number;
  sent: number;
  overdue: number;
  paid: number;
  void: number;
};

export type BillingStatusFilter = 'draft' | 'sent' | 'overdue' | 'paid' | 'void';

export type BillingFilters = {
  status?: BillingStatusFilter;
  /** Free-text over project name / customer name / invoice #id8. */
  search?: string;
  limit?: number;
  offset?: number;
};

export type BillingData = {
  /** Page slice, sorted action-first (overdue → ready → outstanding → … → paid). */
  positions: BillingProjectPosition[];
  cockpit: BillingCockpit;
  statusCounts: BillingStatusCounts;
  /** Project count after filtering (for pagination). */
  totalProjects: number;
};

/** Raw invoice columns the rollup needs. */
type RawInvoice = ArInvoice & {
  id: string;
  project_id: string | null;
  doc_type: 'invoice' | 'draw';
  status: InvoiceStatus;
  tax_cents: number;
  tax_inclusive: boolean;
  payment_method: string | null;
};

function overdueDays(sentAt: string | null | undefined, now: Date): number {
  if (!sentAt) return 0;
  const t = new Date(sentAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/**
 * Sort rank — lower sorts first. Surfaces what needs action:
 *   0 overdue · 1 ready-to-bill · 2 outstanding · 3 draft · 4 paid-in-full.
 */
function actionRank(p: BillingProjectPosition): number {
  if (p.overdue_count > 0) return 0;
  if (p.ready_to_bill) return 1;
  if (p.outstanding_cents > 0) return 2;
  if (p.invoices.some((i) => i.status === 'draft')) return 3;
  return 4;
}

/** Stages where remaining-to-bill should prompt a draw (the rest are dormant). */
const BILLABLE_STAGES: ReadonlySet<LifecycleStage> = new Set(['active', 'complete']);

function customerOf(raw: unknown): { id: string; name: string } | null {
  const c = Array.isArray(raw) ? raw[0] : raw;
  if (!c || typeof c !== 'object') return null;
  const obj = c as { id?: unknown; name?: unknown };
  return typeof obj.id === 'string' && typeof obj.name === 'string'
    ? { id: obj.id, name: obj.name }
    : null;
}

/** Job-site locale ("Chilliwack · BC") from the customer address. */
function regionOf(raw: unknown): string | null {
  const c = Array.isArray(raw) ? raw[0] : raw;
  if (!c || typeof c !== 'object') return null;
  const obj = c as { city?: unknown; province?: unknown };
  const parts = [obj.city, obj.province].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}

export async function getBillingData(filters: BillingFilters = {}): Promise<BillingData> {
  const supabase = await createClient();
  const now = new Date();
  const limit = filters.limit ?? 25;
  const offset = filters.offset ?? 0;

  // Non-deleted invoices that belong to a project — this is the GC surface, so
  // project-less invoices (the job-based pressure-washing model) are excluded in
  // Postgres rather than fetched and dropped in the grouping loop below.
  const { data: invRows, error: invErr } = await supabase
    .from('invoices')
    .select(
      'id, project_id, doc_type, status, amount_cents, tax_cents, tax_inclusive, sent_at, paid_at, payment_method, line_items, deleted_at',
    )
    .is('deleted_at', null)
    .not('project_id', 'is', null);
  if (invErr) throw new Error(`Failed to load invoices for billing: ${invErr.message}`);
  const invoices = (invRows ?? []) as RawInvoice[];

  // Group invoices by project (project-less invoices are not this screen's).
  const byProject = new Map<string, RawInvoice[]>();
  for (const inv of invoices) {
    if (!inv.project_id) continue;
    const arr = byProject.get(inv.project_id);
    if (arr) arr.push(inv);
    else byProject.set(inv.project_id, [inv]);
  }
  const projectIds = Array.from(byProject.keys());

  // Project headers + contract sources (signed-version total + approved COs).
  const [projRes, snapRes, coRes] =
    projectIds.length > 0
      ? await Promise.all([
          supabase
            .from('projects')
            .select('id, name, lifecycle_stage, contacts:contact_id (id, name, city, province)')
            .in('id', projectIds)
            .is('deleted_at', null),
          supabase
            .from('project_scope_snapshots')
            .select('project_id, version_number, total_cents, change_order_id')
            .in('project_id', projectIds),
          supabase
            .from('change_orders')
            .select('id, project_id, cost_impact_cents')
            .in('project_id', projectIds)
            .eq('status', 'approved'),
        ])
      : [{ data: [], error: null }, { data: [] }, { data: [] }];
  if (projRes.error) throw new Error(`Failed to load billing projects: ${projRes.error.message}`);

  // Latest-signed-version total per project = contract base. A CO snapshot
  // total ALREADY folds in that CO (v2 = v1 + CO impact), so we track which
  // COs are captured by a snapshot and only add the *un-snapshotted* approved
  // ones on top — adding all approved COs would double-count.
  const contractBase = new Map<string, number>();
  const latestVersion = new Map<string, number>();
  const snapshottedCoIds = new Set<string>();
  for (const s of snapRes.data ?? []) {
    const row = s as {
      project_id: string;
      version_number: number;
      total_cents: number | null;
      change_order_id: string | null;
    };
    if (row.change_order_id) snapshottedCoIds.add(row.change_order_id);
    if (row.total_cents == null) continue;
    const seen = latestVersion.get(row.project_id) ?? -1;
    if (row.version_number > seen) {
      latestVersion.set(row.project_id, row.version_number);
      contractBase.set(row.project_id, row.total_cents);
    }
  }
  // Approved COs not yet captured by a snapshot version, summed per project.
  const coImpact = new Map<string, number>();
  for (const c of coRes.data ?? []) {
    const row = c as { id: string; project_id: string | null; cost_impact_cents: number };
    if (!row.project_id || snapshottedCoIds.has(row.id)) continue;
    coImpact.set(
      row.project_id,
      (coImpact.get(row.project_id) ?? 0) + (row.cost_impact_cents ?? 0),
    );
  }

  type ProjHeader = {
    id: string;
    name: string;
    lifecycle_stage: LifecycleStage;
    contacts: unknown;
  };
  const headers = new Map<string, ProjHeader>();
  for (const p of projRes.data ?? []) {
    headers.set((p as ProjHeader).id, p as ProjHeader);
  }

  // Build a position per project.
  const positions: BillingProjectPosition[] = [];
  const statusCounts: BillingStatusCounts = {
    all: 0,
    draft: 0,
    sent: 0,
    overdue: 0,
    paid: 0,
    void: 0,
  };

  for (const [projectId, rows] of byProject) {
    const header = headers.get(projectId);
    if (!header) continue; // project soft-deleted or RLS-hidden

    let billed = 0;
    let paid = 0;
    let outstanding = 0;
    let overdueCount = 0;
    let overdueCents = 0;
    let maxOverdueDays = 0;

    const billingInvoices: BillingInvoice[] = rows.map((inv) => {
      const total = invoiceTotalCents(inv);
      const sentOrPaid = inv.status === 'sent' || inv.status === 'paid';
      if (sentOrPaid) billed += total;
      if (inv.status === 'paid') paid += total;
      outstanding += invoiceOutstandingCents(inv);
      const over = isOverdue(inv, now);
      const days = over ? overdueDays(inv.sent_at, now) : 0;
      if (over) {
        overdueCount += 1;
        overdueCents += total;
        if (days > maxOverdueDays) maxOverdueDays = days;
      }

      // Chip counts (by invoice). Overdue is the aged subset of sent.
      statusCounts.all += 1;
      if (inv.status === 'draft') statusCounts.draft += 1;
      else if (inv.status === 'sent') {
        statusCounts.sent += 1;
        if (over) statusCounts.overdue += 1;
      } else if (inv.status === 'paid') statusCounts.paid += 1;
      else if (inv.status === 'void') statusCounts.void += 1;

      return {
        id: inv.id,
        doc_type: inv.doc_type,
        status: inv.status,
        total_cents: total,
        tax_cents: inv.tax_cents,
        tax_inclusive: inv.tax_inclusive,
        sent_at: inv.sent_at ?? null,
        paid_at: inv.paid_at,
        payment_method: inv.payment_method,
        is_overdue: over,
        overdue_days: days,
      };
    });

    // Newest-relevant first inside the expansion (paid/sent date desc).
    billingInvoices.sort((a, b) => {
      const ad = a.paid_at ?? a.sent_at ?? '';
      const bd = b.paid_at ?? b.sent_at ?? '';
      return bd.localeCompare(ad);
    });

    const base = contractBase.get(projectId);
    const contract = base == null ? null : base + (coImpact.get(projectId) ?? 0);
    const remaining = contract == null ? null : contract - billed;
    const stage = header.lifecycle_stage;
    // Ready to bill: active/complete project with unbilled contract value AND
    // nothing overdue — an overdue draw means "chase first", so it suppresses
    // the bill-the-next-draw prompt (overdue owns the rollup + cockpit).
    const isReady =
      BILLABLE_STAGES.has(stage) && remaining != null && remaining > 0 && overdueCount === 0;
    const readyCents = isReady && remaining != null ? Math.max(0, remaining) : 0;

    positions.push({
      project_id: projectId,
      project_name: header.name,
      lifecycle_stage: stage,
      customer: customerOf(header.contacts),
      region: regionOf(header.contacts),
      contract_cents: contract,
      billed_cents: billed,
      paid_cents: paid,
      outstanding_cents: outstanding,
      remaining_cents: remaining,
      overdue_count: overdueCount,
      overdue_cents: overdueCents,
      max_overdue_days: maxOverdueDays,
      ready_to_bill: isReady,
      ready_to_bill_cents: readyCents,
      invoices: billingInvoices,
    });
  }

  // Cockpit aggregates — tenant-wide, before filtering/pagination.
  const cockpit: BillingCockpit = {
    ready_to_bill_cents: 0,
    ready_project_count: 0,
    outstanding_cents: 0,
    outstanding_count: 0,
    outstanding_project_count: 0,
    overdue_cents: 0,
    overdue_count: 0,
    overdue_max_days: 0,
  };
  for (const p of positions) {
    cockpit.ready_to_bill_cents += p.ready_to_bill_cents;
    if (p.ready_to_bill) cockpit.ready_project_count += 1;
    cockpit.outstanding_cents += p.outstanding_cents;
    if (p.outstanding_cents > 0) cockpit.outstanding_project_count += 1;
    cockpit.outstanding_count += p.invoices.filter(
      (i) => i.status === 'sent' && i.paid_at === null,
    ).length;
    cockpit.overdue_cents += p.overdue_cents;
    cockpit.overdue_count += p.overdue_count;
    if (p.max_overdue_days > cockpit.overdue_max_days) {
      cockpit.overdue_max_days = p.max_overdue_days;
    }
  }

  // Filter (status chip + search), then sort action-first, then paginate.
  const search = filters.search?.trim().toLowerCase();
  const filtered = positions.filter((p) => {
    if (filters.status) {
      const has =
        filters.status === 'overdue'
          ? p.overdue_count > 0
          : p.invoices.some((i) => i.status === filters.status);
      if (!has) return false;
    }
    if (search) {
      const hay = `${p.project_name} ${p.customer?.name ?? ''}`.toLowerCase();
      const idHit = p.invoices.some((i) => i.id.slice(0, 8).toLowerCase().includes(search));
      if (!hay.includes(search) && !idHit) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const ra = actionRank(a);
    const rb = actionRank(b);
    if (ra !== rb) return ra - rb;
    // Within overdue, oldest debt first; otherwise biggest outstanding first.
    if (ra === 0) return b.max_overdue_days - a.max_overdue_days;
    if (ra === 1) return b.ready_to_bill_cents - a.ready_to_bill_cents;
    if (ra === 2) return b.outstanding_cents - a.outstanding_cents;
    return a.project_name.localeCompare(b.project_name);
  });

  return {
    positions: filtered.slice(offset, offset + limit),
    cockpit,
    statusCounts,
    totalProjects: filtered.length,
  };
}
