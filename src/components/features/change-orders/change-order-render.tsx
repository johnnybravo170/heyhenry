/**
 * Pure customer-facing render of a change order, on the shared
 * `<CustomerDocument>` shell — the SAME letterhead the estimate and invoice
 * use, so all three read as one company. Shared between the public
 * `/approve/[code]` page and the operator send-preview so both show exactly
 * what the homeowner receives.
 *
 * Hard boundary: PRICE ONLY. Never unit_cost / markup / supplier cost /
 * margin renders here (the operator margin read lives only in the editor).
 *
 * Money routes through <Money>; dates are pre-formatted by the caller in the
 * tenant tz. The totals block is signed (+/- deltas) via the shell's
 * `signed` row flag: Cost of work → Management fee → province-aware GST/HST
 * → Total impact.
 */

import { ChangeOrderActionChip } from '@/components/features/change-orders/change-order-action-chip';
import { ChangeOrderDiffView } from '@/components/features/change-orders/change-order-diff-view';
import {
  type CustomerDocStatus,
  type CustomerDocTotalsRow,
  CustomerDocument,
} from '@/components/features/projects/customer-document';
import { Money } from '@/components/ui/money';
import type { ChangeOrderWhy } from '@/lib/change-orders/why-summary';
import type { ChangeOrderLineRow } from '@/lib/db/queries/change-orders';

export type ChangeOrderTaxLine = { label: string; cents: number };

export type ChangeOrderRenderProps = {
  // Letterhead
  businessName: string;
  logoUrl: string | null;
  businessMeta?: string | null;
  customerName: string;
  customerAddress?: string | null;
  projectName: string;
  /** Pre-formatted "Sent May 22, 2026" in tenant tz, or null. */
  docDate?: string | null;
  status?: CustomerDocStatus | null;

  title: string;
  why: ChangeOrderWhy;

  // Price-only impact (all signed cents)
  costOfWorkCents: number;
  mgmtFeeCents: number;
  mgmtFeeRate: number;
  /** Province-aware tax lines (already filtered to GST/HST — no PST). */
  taxLines: ChangeOrderTaxLine[];
  totalImpactCents: number;
  /** Running project total AFTER this CO, and the "was" before it. */
  newProjectTotalCents: number;
  previousProjectTotalCents: number;
  timelineDays: number;
  /** Pre-formatted substantial-completion date, or null. */
  substantialCompletionDate?: string | null;

  // Diff
  diffLines: ChangeOrderLineRow[];
  categoryNotes: { budget_category_id: string; note: string }[];
  budgetCategoryNamesById: Record<string, string>;

  gstNumber?: string | null;
  wcbNumber?: string | null;

  /** Approve / done slot. */
  actionZone?: React.ReactNode;
};

export function ChangeOrderRender({
  businessName,
  logoUrl,
  businessMeta,
  customerName,
  customerAddress,
  projectName,
  docDate,
  status,
  title,
  why,
  costOfWorkCents,
  mgmtFeeCents,
  mgmtFeeRate,
  taxLines,
  totalImpactCents,
  newProjectTotalCents,
  previousProjectTotalCents,
  timelineDays,
  substantialCompletionDate,
  diffLines,
  categoryNotes,
  budgetCategoryNamesById,
  gstNumber,
  wcbNumber,
  actionZone,
}: ChangeOrderRenderProps) {
  const totalsRows: CustomerDocTotalsRow[] = [
    { label: 'Cost of work', cents: costOfWorkCents, signed: true },
  ];
  if (mgmtFeeCents !== 0) {
    totalsRows.push({
      label: `Management fee (${(mgmtFeeRate * 100).toFixed(2).replace(/\.?0+$/, '')}%)`,
      cents: mgmtFeeCents,
      signed: true,
    });
  }
  for (const t of taxLines) {
    totalsRows.push({ label: t.label, cents: t.cents, signed: true });
  }

  const showDiff = diffLines.length > 0 || categoryNotes.length > 0;

  return (
    <CustomerDocument
      logoUrl={logoUrl}
      businessName={businessName}
      businessMeta={businessMeta ?? null}
      docEyebrow="Change order"
      docDate={docDate ?? null}
      status={status ?? null}
      customerName={customerName}
      customerAddress={customerAddress ?? null}
      projectName={projectName}
      totals={{ rows: totalsRows, totalCents: totalImpactCents, totalLabel: 'Total impact' }}
      gstNumber={gstNumber ?? null}
      wcbNumber={wcbNumber ?? null}
      actionZone={actionZone}
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>

      {/* What's changing & why — the trust moment, in rust-soft Henry-style
          chrome above the impact card. */}
      <section className="mb-6 rounded-xl border border-brand/20 bg-brand/5 p-5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">What's changing &amp; why</h3>
          {why.authoredByHenry ? (
            <span className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-brand">
              ✦ Henry
            </span>
          ) : null}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {why.text}
        </p>
      </section>

      {/* Price-only impact card. */}
      <section className="mb-6 rounded-xl border bg-muted/30 p-5">
        <div className="grid gap-5 sm:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Total cost impact
            </p>
            <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
              <Money cents={totalImpactCents} signed emphasis />
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              New project total{' '}
              <span className="font-semibold tabular-nums text-foreground">
                <Money cents={newProjectTotalCents} symbol />
              </span>
              {previousProjectTotalCents > 0 ? (
                <>
                  {' · '}
                  <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                    <Money cents={previousProjectTotalCents} symbol />
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <div>
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Timeline impact
            </p>
            <p className="mt-1.5 text-xl font-bold">
              {timelineDays === 0
                ? 'None'
                : `${timelineDays > 0 ? '+' : ''}${timelineDays} day${Math.abs(timelineDays) === 1 ? '' : 's'}`}
            </p>
            {substantialCompletionDate ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Substantial completion{' '}
                <span className="font-medium text-foreground">{substantialCompletionDate}</span>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {showDiff ? (
        <section className="mb-2">
          <h3 className="mb-2.5 text-sm font-semibold">Line-level changes</h3>
          <ChangeOrderDiffView
            diffLines={diffLines}
            categoryNotes={categoryNotes}
            budgetCategoryNamesById={budgetCategoryNamesById}
          />
          {/* Summary chips — at-a-glance count by action type. */}
          {diffLines.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {(['add', 'modify', 'remove', 'modify_envelope'] as const).map((action) => {
                const count = diffLines.filter((d) => d.action === action).length;
                if (count === 0) return null;
                return <ChangeOrderActionChip key={action} action={action} count={count} />;
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </CustomerDocument>
  );
}
