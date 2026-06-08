/**
 * Daily cron — materialize expenses for recurring rules.
 *
 * For every active rule whose next_run_at <= today:
 *   1. Create a new expenses row cloning the rule's template fields,
 *      with expense_date = next_run_at.
 *   2. Advance next_run_at to the same day of the following month.
 *
 * Skips rules whose next_run_at falls on or before the tenant's
 * books_closed_through (can't backdate into a locked period).
 *
 * Idempotent: if today's run already created an expense for a rule
 * (linked via recurring_rule_id + matching expense_date), we skip —
 * prevents double-creation if the cron runs twice on the same day.
 *
 * Auth: Bearer ${CRON_SECRET} (Vercel cron injects this header). Matches
 * every other cron route — without it this data-mutating endpoint is open
 * to the public internet.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function addOneMonth(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  // day_of_month is capped at 28 in the schema, so no month-length edge case.
  const next = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: rules, error } = await admin
    .from('expense_recurring_rules')
    .select(
      'id, tenant_id, created_by, category_id, vendor, description, amount_cents, tax_cents, next_run_at',
    )
    .eq('active', true)
    .lte('next_run_at', today);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = rules ?? [];
  let created = 0;
  let skippedClosedBooks = 0;
  let skippedDuplicate = 0;

  // Batch every per-rule read up front so the loop issues zero N+1 queries.
  // (At 10k tenants this is the difference between ~4 queries/rule and 4 total.)
  const tenantIds = [...new Set(rows.map((r) => r.tenant_id as string))];
  const ruleIds = rows.map((r) => r.id as string);
  const runDates = [...new Set(rows.map((r) => r.next_run_at as string))];
  const createdByIds = [
    ...new Set(rows.map((r) => r.created_by as string | null).filter((v): v is string => !!v)),
  ];

  const [tenantsRes, creatorsRes, ownersRes, existingRes] = await Promise.all([
    tenantIds.length > 0
      ? admin.from('tenants').select('id, books_closed_through').in('id', tenantIds)
      : Promise.resolve({ data: [] as { id: string; books_closed_through: string | null }[] }),
    createdByIds.length > 0
      ? admin.from('tenant_members').select('id, user_id').in('id', createdByIds)
      : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
    tenantIds.length > 0
      ? admin
          .from('tenant_members')
          .select('tenant_id, user_id')
          .in('tenant_id', tenantIds)
          .eq('role', 'owner')
      : Promise.resolve({ data: [] as { tenant_id: string; user_id: string }[] }),
    ruleIds.length > 0
      ? admin
          .from('project_costs')
          .select('recurring_rule_id, cost_date')
          .eq('source_type', 'receipt')
          .in('recurring_rule_id', ruleIds)
          .in('cost_date', runDates)
      : Promise.resolve({ data: [] as { recurring_rule_id: string; cost_date: string }[] }),
  ]);

  const closedThroughByTenant = new Map<string, string | null>(
    (tenantsRes.data ?? []).map((t) => [
      t.id as string,
      (t.books_closed_through as string | null) ?? null,
    ]),
  );
  const userIdByMemberId = new Map<string, string>(
    (creatorsRes.data ?? []).map((m) => [m.id as string, m.user_id as string]),
  );
  // First owner seen per tenant — fallback attribution when the creator is gone.
  const ownerUserIdByTenant = new Map<string, string>();
  for (const o of ownersRes.data ?? []) {
    const tid = o.tenant_id as string;
    if (!ownerUserIdByTenant.has(tid)) ownerUserIdByTenant.set(tid, o.user_id as string);
  }
  // Idempotency keys for receipts already materialized for (rule, date).
  const existingCostKeys = new Set(
    (existingRes.data ?? []).map(
      (c) => `${c.recurring_rule_id as string}|${c.cost_date as string}`,
    ),
  );

  for (const rule of rows) {
    const tenantId = rule.tenant_id as string;
    const runDate = rule.next_run_at as string;

    // Honor the tenant's books-closed-through guard.
    const closedThrough = closedThroughByTenant.get(tenantId) ?? null;
    if (closedThrough && runDate <= closedThrough) {
      skippedClosedBooks++;
      // Still advance the rule so we don't spin on the same locked date.
      await admin
        .from('expense_recurring_rules')
        .update({ next_run_at: addOneMonth(runDate), updated_at: new Date().toISOString() })
        .eq('id', rule.id as string);
      continue;
    }

    // Idempotency: skip if a receipt already exists for this rule on this date.
    if (existingCostKeys.has(`${rule.id as string}|${runDate}`)) {
      skippedDuplicate++;
      await admin
        .from('expense_recurring_rules')
        .update({ next_run_at: addOneMonth(runDate), updated_at: new Date().toISOString() })
        .eq('id', rule.id as string);
      continue;
    }

    // Resolve a user_id for the expense row (we want created_by to be the
    // rule's creator so the audit trail is sensible). Falls back to the
    // first owner on the tenant if the creator member has been removed.
    let userId: string | null = null;
    if (rule.created_by) {
      userId = userIdByMemberId.get(rule.created_by as string) ?? null;
    }
    if (!userId) {
      userId = ownerUserIdByTenant.get(tenantId) ?? null;
    }
    if (!userId) continue; // defensive — nobody to attribute to

    const { error: insErr } = await admin.from('project_costs').insert({
      tenant_id: tenantId,
      user_id: userId,
      project_id: null,
      budget_category_id: null,
      job_id: null,
      category_id: rule.category_id as string | null,
      recurring_rule_id: rule.id as string,
      amount_cents: rule.amount_cents as number,
      gst_cents: (rule.tax_cents as number) ?? 0,
      vendor: (rule.vendor as string | null) ?? null,
      description: (rule.description as string | null) ?? null,
      cost_date: runDate,
      source_type: 'receipt',
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      status: 'active',
    });
    if (insErr) {
      // Don't advance on error — we want to retry tomorrow.
      continue;
    }
    created++;

    await admin
      .from('expense_recurring_rules')
      .update({ next_run_at: addOneMonth(runDate), updated_at: new Date().toISOString() })
      .eq('id', rule.id as string);
  }

  return Response.json({
    ok: true,
    today,
    rules_checked: rows.length,
    expenses_created: created,
    skipped_closed_books: skippedClosedBooks,
    skipped_duplicate: skippedDuplicate,
  });
}
