/**
 * Stands up the GC / renovation-vertical demo tenant — "Maple Ridge Renos".
 *
 * Overflow Test Co is a `pressure_washing` tenant, so it has no projects /
 * budgets / change-orders and can't exercise the GC surfaces (Project Hub,
 * Budget, Spend, Labour, Billing). This is its renovation-vertical sibling:
 * a `vertical='renovation'`, `is_demo=true` tenant seeded with a real project
 * and a populated budget so GC screens can be click-tested safely.
 *
 * Idempotent — safe to re-run (rotates passwords, re-activates members, and
 * skips data seeding if the demo project already exists).
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   node scripts/setup-gc-demo-tenant.mjs
 *
 * `is_demo=true` means outbound email/SMS are suppressed and the tenant is
 * excluded from platform metrics (src/lib/tenants/demo.ts). See docs/qa-tenant.md.
 */
import { createClient } from '@supabase/supabase-js';

const TENANT_NAME = 'Maple Ridge Renos';
const OWNER_EMAIL = 'gcdemo@example.com';
const WORKER_EMAIL = 'gcdemo+worker@example.com';
const DEMO_PROJECT_NAME = 'Maple Heights Full Home Reno';

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GC_DEMO_PASSWORD } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}
// Shared demo password — sourced from env, never committed. The tenant is
// demo-flagged and inert, but credentials still don't belong in git. Value
// lives in 1Password:
//   export GC_DEMO_PASSWORD="$(op read op://Agents/gc-demo-password/password)"
const PASSWORD = GC_DEMO_PASSWORD;
if (!PASSWORD) {
  console.error('Need GC_DEMO_PASSWORD in env (op read op://Agents/gc-demo-password/password).');
  process.exit(1);
}
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findUser(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function ensureUser(email) {
  const existing = await findUser(email);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    console.log(`  reset password: ${email}`);
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data?.user) throw error ?? new Error(`createUser failed for ${email}`);
  console.log(`  created user: ${email}`);
  return data.user.id;
}

async function ensureMember(tenantId, userId, role, firstName, lastName) {
  const { data: existing } = await supabase
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  const payload = {
    role,
    is_active_for_user: true,
    first_name: firstName,
    last_name: lastName,
    phone: '+16045550100',
    phone_verified_at: new Date().toISOString(),
  };
  if (existing) {
    const { error } = await supabase.from('tenant_members').update(payload).eq('id', existing.id);
    if (error) throw error;
    console.log(`  member updated: ${role}`);
  } else {
    const { error } = await supabase
      .from('tenant_members')
      .insert({ tenant_id: tenantId, user_id: userId, ...payload });
    if (error) throw error;
    console.log(`  member created: ${role}`);
  }
}

/** Find the demo tenant via the owner's membership, else create it. */
async function ensureTenant(ownerId) {
  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', ownerId)
    .maybeSingle();
  if (membership?.tenant_id) {
    await supabase
      .from('tenants')
      .update({ is_demo: true, vertical: 'renovation' })
      .eq('id', membership.tenant_id);
    console.log(`  tenant reused: ${membership.tenant_id}`);
    return membership.tenant_id;
  }
  const { data, error } = await supabase
    .from('tenants')
    .insert({ name: TENANT_NAME, vertical: 'renovation', is_demo: true })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('tenant insert failed');
  console.log(`  tenant created: ${data.id}`);
  return data.id;
}

async function seedGcData(tenantId) {
  const { data: existingProject } = await supabase
    .from('projects')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', DEMO_PROJECT_NAME)
    .maybeSingle();
  if (existingProject) {
    console.log('  GC data already seeded — skipping.');
    return;
  }

  const { data: customer, error: customerErr } = await supabase
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      name: 'The Mahmoud Family',
      email: 'mahmoud.demo@example.com',
      phone: '+16045550148',
      type: 'residential',
      kind: 'customer',
      city: 'Maple Ridge',
      province: 'BC',
    })
    .select('id')
    .single();
  if (customerErr || !customer) throw new Error(`customer insert: ${customerErr?.message}`);
  const customerId = customer.id;

  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .insert({
      tenant_id: tenantId,
      contact_id: customerId,
      name: DEMO_PROJECT_NAME,
      description: 'Full-home renovation: kitchen, two baths, flooring throughout, new envelope.',
      lifecycle_stage: 'active',
      management_fee_rate: 0.18,
      is_cost_plus: true,
      start_date: '2026-03-02',
      target_end_date: '2026-07-31',
      estimate_status: 'approved',
      estimate_approved_at: new Date().toISOString(),
      estimate_approved_by_name: 'The Mahmoud Family',
    })
    .select('id')
    .single();
  if (projectErr || !project) throw new Error(`project insert: ${projectErr?.message}`);
  const projectId = project.id;

  // Budget categories across three sections. estimate_cents in cents.
  const catSpecs = [
    { name: 'Demolition', section: 'Site & structure', est: 480000, order: 1 },
    { name: 'Framing', section: 'Site & structure', est: 620000, order: 2 },
    { name: 'Electrical', section: 'Trades', est: 1450000, order: 3 },
    { name: 'Plumbing', section: 'Trades', est: 1820000, order: 4 },
    { name: 'HVAC', section: 'Trades', est: 900000, order: 5 },
    { name: 'Cabinets', section: 'Finishes', est: 1500000, order: 6 },
    { name: 'Flooring', section: 'Finishes', est: 1100000, order: 7 },
    { name: 'Paint', section: 'Finishes', est: 350000, order: 8 },
  ];
  // Sections are a real entity — insert them first so categories reference
  // section_id (the legacy `section` string column no longer exists).
  const sectionNames = [...new Set(catSpecs.map((c) => c.section))];
  const { data: secRows } = await supabase
    .from('project_budget_sections')
    .insert(
      sectionNames.map((name, i) => ({
        tenant_id: tenantId,
        project_id: projectId,
        name,
        sort_order: i,
      })),
    )
    .select('id, name');
  const sectionId = Object.fromEntries((secRows ?? []).map((s) => [s.name, s.id]));

  const { data: cats } = await supabase
    .from('project_budget_categories')
    .insert(
      catSpecs.map((c) => ({
        tenant_id: tenantId,
        project_id: projectId,
        name: c.name,
        section_id: sectionId[c.section] ?? null,
        estimate_cents: c.est,
        display_order: c.order,
        is_visible_in_report: true,
      })),
    )
    .select('id, name');
  const catId = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  // A couple of itemized categories (cost lines drive their estimate).
  await supabase.from('project_cost_lines').insert([
    {
      project_id: projectId,
      budget_category_id: catId.Cabinets,
      category: 'material',
      label: 'Shaker uppers + lowers',
      qty: 1,
      unit: 'set',
      unit_cost_cents: 900000,
      unit_price_cents: 1200000,
      markup_pct: 33,
      line_cost_cents: 900000,
      line_price_cents: 1200000,
      sort_order: 1,
    },
    {
      project_id: projectId,
      budget_category_id: catId.Cabinets,
      category: 'labour',
      label: 'Install + hardware',
      qty: 24,
      unit: 'hr',
      unit_cost_cents: 8000,
      unit_price_cents: 12500,
      markup_pct: 56,
      line_cost_cents: 192000,
      line_price_cents: 300000,
      sort_order: 2,
    },
    {
      project_id: projectId,
      budget_category_id: catId.Plumbing,
      category: 'sub',
      label: 'Rough-in + fixtures (Tomic Plumbing)',
      qty: 1,
      unit: 'job',
      unit_cost_cents: 1300000,
      unit_price_cents: 1820000,
      markup_pct: 40,
      line_cost_cents: 1300000,
      line_price_cents: 1820000,
      sort_order: 1,
    },
  ]);

  // Realized spend (receipts/bills) — Framing goes OVER its envelope so the
  // over-budget flag + red segment show; Electrical + Demolition partial.
  // `paid` rows MUST carry paid_at (project_costs_paid_at_consistency check).
  const now = new Date().toISOString();
  const { error: costErr } = await supabase.from('project_costs').insert([
    {
      tenant_id: tenantId,
      project_id: projectId,
      budget_category_id: catId.Demolition,
      source_type: 'receipt',
      payment_status: 'paid',
      paid_at: now,
      amount_cents: 310000,
      description: 'Disposal bins + demo crew',
    },
    {
      tenant_id: tenantId,
      project_id: projectId,
      budget_category_id: catId.Framing,
      source_type: 'vendor_bill',
      payment_status: 'unpaid',
      amount_cents: 735000,
      pre_tax_amount_cents: 700000,
      vendor: 'Westline Framing',
      description: 'Framing labour + lumber (over estimate)',
    },
    {
      tenant_id: tenantId,
      project_id: projectId,
      budget_category_id: catId.Electrical,
      source_type: 'vendor_bill',
      payment_status: 'paid',
      paid_at: now,
      amount_cents: 892500,
      pre_tax_amount_cents: 850000,
      vendor: 'Brightwire Electric',
      description: 'Rough-in',
    },
    {
      tenant_id: tenantId,
      project_id: projectId,
      budget_category_id: catId.Cabinets,
      source_type: 'receipt',
      payment_status: 'paid',
      paid_at: now,
      amount_cents: 450000,
      description: 'Cabinet deposit',
    },
  ]);
  if (costErr) throw new Error(`project_costs insert: ${costErr.message}`);

  console.log(`  seeded project + 8 categories + cost lines + spend (project ${projectId})`);
}

async function main() {
  const ownerId = await ensureUser(OWNER_EMAIL);
  const tenantId = await ensureTenant(ownerId);
  await ensureMember(tenantId, ownerId, 'owner', 'Riley', 'Maple');

  const workerId = await ensureUser(WORKER_EMAIL);
  await ensureMember(tenantId, workerId, 'worker', 'Sam', 'Crew');

  await seedGcData(tenantId);

  console.log(`\nGC demo ready — ${TENANT_NAME} (${tenantId})`);
  console.log('  password: from $GC_DEMO_PASSWORD (not printed)');
  console.log(`  owner   ${OWNER_EMAIL}  → /dashboard`);
  console.log(`  worker  ${WORKER_EMAIL}  → /w`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
