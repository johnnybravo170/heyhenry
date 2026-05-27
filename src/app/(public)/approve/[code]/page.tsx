import { ChangeOrderRender } from '@/components/features/change-orders/change-order-render';
import type { CustomerDocStatus } from '@/components/features/projects/customer-document';
import { PublicViewLogger } from '@/components/features/public/public-view-logger';
import { changeOrderWhy } from '@/lib/change-orders/why-summary';
import { formatDate } from '@/lib/date/format';
import type { ChangeOrderLineRow } from '@/lib/db/queries/change-orders';
import { formatCurrency } from '@/lib/pricing/calculator';
import { canadianTax } from '@/lib/providers/tax/canadian';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApprovalForm } from './approval-form';

export const metadata = {
  title: 'Change Order — HeyHenry',
};

const LOGO_SIGN_SECONDS = 60 * 60 * 24 * 30;

function CenteredNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </div>
  );
}

export default async function ApprovalPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const admin = createAdminClient();

  // Look up change order by approval code.
  const { data: co } = await admin
    .from('change_orders')
    .select(
      `id, project_id, tenant_id, title, description, reason, cost_impact_cents, timeline_impact_days,
       status, approved_by_name, approved_at, declined_at, declined_reason, approval_code,
       flow_version, category_notes, management_fee_override_rate,
       projects:project_id (name, management_fee_rate, contacts:contact_id (name, address_line1, city, province, postal_code)),
       tenants:tenant_id (name, logo_storage_path, timezone, gst_number, wcb_number)`,
    )
    .eq('approval_code', code)
    .single();

  if (!co) {
    return (
      <CenteredNotice
        title="Change Order Not Found"
        body="This link may have expired or the change order may have been voided."
      />
    );
  }

  const coData = co as Record<string, unknown>;
  const project = coData.projects as Record<string, unknown> | null;
  const tenant = coData.tenants as Record<string, unknown> | null;
  const customerRaw = (project?.contacts as Record<string, unknown> | null) ?? null;
  const projectName = (project?.name as string) ?? 'Project';
  const businessName = (tenant?.name as string) ?? 'Your Contractor';
  const tenantTz = (tenant?.timezone as string | null) ?? undefined;
  const tenantId = coData.tenant_id as string;

  // Terminal states — short notices, not the full doc.
  if (coData.status === 'approved') {
    return (
      <CenteredNotice
        title="Already Approved"
        body={`This change order was approved by ${coData.approved_by_name as string} on ${formatDate(
          coData.approved_at as string,
          { timezone: tenantTz, style: 'long' },
        )}.`}
      />
    );
  }
  if (coData.status === 'declined') {
    return (
      <CenteredNotice
        title="Change Order Declined"
        body={`This change order was declined.${
          coData.declined_reason ? ` Reason: ${coData.declined_reason}` : ''
        }`}
      />
    );
  }
  if (coData.status === 'voided') {
    return (
      <CenteredNotice
        title="Change Order Voided"
        body="This change order has been cancelled by the contractor."
      />
    );
  }
  if (coData.status !== 'pending_approval') {
    return (
      <CenteredNotice
        title="Not Available"
        body="This change order is not currently awaiting approval."
      />
    );
  }

  // ── Price-only impact math (mirrors the operator editor; customer sees
  //    Cost of work → Management fee → province-aware GST/HST → Total). ──
  const costCents = coData.cost_impact_cents as number;
  const projectFeeRate = (project?.management_fee_rate as number | null) ?? 0;
  const overrideFeeRate = coData.management_fee_override_rate as number | null;
  const coFeeRate = overrideFeeRate ?? projectFeeRate;
  const coFeeCents = Math.round(costCents * coFeeRate);
  const beforeTaxCents = costCents + coFeeCents;

  // Province-aware GST/HST — same customer-facing tax provider Customer
  // Documents use (PST/RST/QST stripped — contractors embed those). The
  // delta is taxed on the pre-tax change amount.
  const taxCtx = await canadianTax.getCustomerFacingContext(tenantId);
  const taxLines = taxCtx.breakdown.map((b) => {
    const provinceSuffix = taxCtx.provinceCode ? ` · ${taxCtx.provinceCode}` : '';
    return {
      label: `${b.label}${provinceSuffix}`,
      cents: Math.round(beforeTaxCents * b.rate),
    };
  });
  const taxTotalCents = taxLines.reduce((s, t) => s + t.cents, 0);
  const totalImpactCents = beforeTaxCents + taxTotalCents;

  // Running project total (lines + project-rate fee) + this CO's full impact.
  const projectIdForTotal = coData.project_id as string;
  const { data: linesForTotal } = await admin
    .from('project_cost_lines')
    .select('line_price_cents')
    .eq('project_id', projectIdForTotal);
  const currentLinesCents = ((linesForTotal ?? []) as { line_price_cents: number }[]).reduce(
    (s, l) => s + l.line_price_cents,
    0,
  );
  const previousProjectTotalCents =
    currentLinesCents + Math.round(currentLinesCents * projectFeeRate);
  const newProjectTotalCents = previousProjectTotalCents + totalImpactCents;

  const timelineDays = coData.timeline_impact_days as number;

  // v2 line-level diff + per-category notes. v1 stays text-only (no diff).
  const flowVersion = (coData.flow_version as number | null) ?? 1;
  const categoryNotes =
    (coData.category_notes as { budget_category_id: string; note: string }[] | null) ?? [];

  let diffLines: ChangeOrderLineRow[] = [];
  let budgetCategoryNamesById: Record<string, string> = {};
  if (flowVersion === 2) {
    const { data: lines } = await admin
      .from('change_order_lines')
      .select(
        'id, change_order_id, action, original_line_id, budget_category_id, category, label, qty, unit, unit_cost_cents, unit_price_cents, line_cost_cents, line_price_cents, notes, before_snapshot',
      )
      .eq('change_order_id', coData.id as string)
      .order('created_at', { ascending: true });
    diffLines = (lines ?? []) as ChangeOrderLineRow[];

    const { data: cats } = await admin
      .from('project_budget_categories')
      .select('id, name')
      .eq('project_id', projectIdForTotal);
    budgetCategoryNamesById = Object.fromEntries(
      ((cats ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
    );
  }

  const why = changeOrderWhy({
    description: coData.description as string | null,
    diffLines,
    timelineDays,
  });

  // Sign the tenant logo (private `photos` bucket) so the customer doc shows
  // the GC's letterhead, not a text fallback.
  let logoUrl: string | null = null;
  const logoPath = tenant?.logo_storage_path as string | null;
  if (logoPath) {
    const { data: signed } = await admin.storage
      .from('photos')
      .createSignedUrl(logoPath, LOGO_SIGN_SECONDS);
    logoUrl = signed?.signedUrl ?? null;
  }

  const customerAddress = customerRaw
    ? [
        customerRaw.address_line1,
        [customerRaw.city, customerRaw.province].filter(Boolean).join(', '),
        customerRaw.postal_code,
      ]
        .filter(Boolean)
        .join('\n') || null
    : null;

  const status: CustomerDocStatus = { label: 'Pending', tone: 'warning' };
  const approveLabel = `Approve — ${totalImpactCents >= 0 ? '+' : ''}${formatCurrency(totalImpactCents)}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 pb-28 sm:pb-10">
      <PublicViewLogger resourceType="change_order" identifier={code} />
      <ChangeOrderRender
        businessName={businessName}
        logoUrl={logoUrl}
        customerName={(customerRaw?.name as string) ?? 'Customer'}
        customerAddress={customerAddress}
        projectName={projectName}
        docDate={null}
        status={status}
        title={coData.title as string}
        why={why}
        costOfWorkCents={costCents}
        mgmtFeeCents={coFeeCents}
        mgmtFeeRate={coFeeRate}
        taxLines={taxLines}
        totalImpactCents={totalImpactCents}
        newProjectTotalCents={newProjectTotalCents}
        previousProjectTotalCents={previousProjectTotalCents}
        timelineDays={timelineDays}
        diffLines={diffLines}
        categoryNotes={categoryNotes}
        budgetCategoryNamesById={budgetCategoryNamesById}
        gstNumber={(tenant?.gst_number as string | null) ?? null}
        wcbNumber={(tenant?.wcb_number as string | null) ?? null}
        actionZone={<ApprovalForm approvalCode={code} approveLabel={approveLabel} />}
      />
    </div>
  );
}
