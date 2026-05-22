/**
 * Business Health AR/revenue parity (integration).
 *
 * The `get_business_health_metrics` RPC used to sum `amount_cents + tax_cents`
 * unconditionally — double-counting tax on tax-inclusive invoices and ignoring
 * the additive `line_items` on tax-exclusive ones. Migration
 * 20260522170008 repointed it at a SQL `invoice_total_cents` that mirrors the
 * TS `invoiceTotalCents`.
 *
 * This test pins the parity the AR-single-source card requires: the RPC's
 * `ar_outstanding.total_cents` must equal the canonical `arOutstanding()`
 * helper (which the Dashboard also uses) over the same rows — including the
 * two cases the old math got wrong.
 *
 * Skipped without DATABASE_URL + Supabase service-role + anon credentials.
 */

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type ArInvoice, arOutstanding } from '@/lib/invoices/ar';
import { invoiceTotalCents } from '@/lib/invoices/totals';

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const canRun = Boolean(process.env.DATABASE_URL && supaUrl && serviceKey && anonKey);

describe.skipIf(!canRun)('Business Health AR parity (integration)', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `bh-ar-${stamp}@heyhenry.test`;
  const password = 'Correct-Horse-9';

  let admin: SupabaseClient;
  let userId: string;
  let tenantId: string;

  // The sent/unpaid invoices that make up AR. Mixed tax shapes on purpose —
  // these are exactly the rows the old RPC mis-summed.
  const arRows: ArInvoice[] = [
    // tax_inclusive: amount IS the total. Old RPC returned 10_500 (double-count).
    {
      status: 'sent',
      paid_at: null,
      deleted_at: null,
      sent_at: '2026-02-01T00:00:00Z',
      amount_cents: 10_000,
      tax_cents: 500,
      tax_inclusive: true,
      line_items: [],
    },
    // tax_exclusive with additive line items. Old RPC ignored line_items.
    {
      status: 'sent',
      paid_at: null,
      deleted_at: null,
      sent_at: '2026-02-01T00:00:00Z',
      amount_cents: 10_000,
      tax_cents: 500,
      tax_inclusive: false,
      line_items: [{ total_cents: 2_000 }],
    },
  ];

  beforeAll(async () => {
    admin = createSupabaseClient(supaUrl as string, serviceKey as string, {
      auth: { persistSession: false },
    });

    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    userId = created.data.user?.id as string;
    if (!userId) throw new Error('createUser failed');

    const tenantInsert = await admin
      .from('tenants')
      .insert({ name: `BH AR ${stamp}` })
      .select('id')
      .single();
    tenantId = tenantInsert.data?.id as string;
    if (!tenantId) throw new Error('tenant insert failed');

    await admin
      .from('tenant_members')
      .insert({ tenant_id: tenantId, user_id: userId, role: 'owner', is_active_for_user: true });

    const customer = await admin
      .from('customers')
      .insert({ tenant_id: tenantId, name: `cust-${stamp}`, type: 'residential', kind: 'customer' })
      .select('id')
      .single();
    const customerId = customer.data?.id as string;

    const baseRow = (overrides: Record<string, unknown>) => ({
      tenant_id: tenantId,
      customer_id: customerId,
      ...overrides,
    });

    // The two AR rows that should count.
    await admin.from('invoices').insert([
      baseRow({
        status: 'sent',
        sent_at: '2026-02-01T00:00:00Z',
        amount_cents: 10_000,
        tax_cents: 500,
        tax_inclusive: true,
        line_items: [],
      }),
      baseRow({
        status: 'sent',
        sent_at: '2026-02-01T00:00:00Z',
        amount_cents: 10_000,
        tax_cents: 500,
        tax_inclusive: false,
        line_items: [{ total_cents: 2_000 }],
      }),
      // Excluded from AR: paid, draft, soft-deleted.
      baseRow({
        status: 'paid',
        paid_at: '2026-02-05T00:00:00Z',
        amount_cents: 9_999,
        tax_cents: 100,
        tax_inclusive: true,
        line_items: [],
      }),
      baseRow({ status: 'draft', amount_cents: 9_999, tax_cents: 100, tax_inclusive: false }),
      baseRow({
        status: 'sent',
        sent_at: '2026-02-01T00:00:00Z',
        amount_cents: 9_999,
        tax_cents: 100,
        tax_inclusive: true,
        deleted_at: '2026-02-02T00:00:00Z',
      }),
    ]);
  }, 30_000);

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
    // Tenant + invoices cascade or are left inert; the user delete is the
    // important cleanup (auth quota). Mirrors the RLS suite's teardown.
  });

  it('RPC ar_outstanding equals the canonical arOutstanding() helper', async () => {
    const anon = createSupabaseClient(supaUrl as string, anonKey as string, {
      auth: { persistSession: false },
    });
    const signIn = await anon.auth.signInWithPassword({ email, password });
    expect(signIn.error).toBeNull();

    const { data, error } = await anon.rpc('get_business_health_metrics', { p_year: 2026 });
    expect(error).toBeNull();

    const expected = arOutstanding(arRows);
    // tax_inclusive 10_000 + tax_exclusive (10_000 + 2_000 + 500) = 22_500.
    expect(expected).toBe(22_500);

    const rpcAr = (data as { ar_outstanding: { total_cents: number } }).ar_outstanding.total_cents;
    expect(rpcAr).toBe(expected);
  });

  it('RPC revenue_ytd is tax-aware for the paid invoice', async () => {
    const anon = createSupabaseClient(supaUrl as string, anonKey as string, {
      auth: { persistSession: false },
    });
    await anon.auth.signInWithPassword({ email, password });
    const { data } = await anon.rpc('get_business_health_metrics', { p_year: 2026 });

    // The single paid invoice is tax_inclusive 9_999 — amount IS the total.
    const expectedRevenue = invoiceTotalCents({
      amount_cents: 9_999,
      tax_cents: 100,
      tax_inclusive: true,
      line_items: [],
    });
    expect(expectedRevenue).toBe(9_999);
    expect((data as { revenue_ytd_cents: number }).revenue_ytd_cents).toBe(expectedRevenue);
  });
});
