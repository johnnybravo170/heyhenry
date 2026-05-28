'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode, useState } from 'react';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Money } from '@/components/ui/money';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import type { AppliedChangeOrderContribution } from '@/lib/db/queries/change-orders';
import { withFrom } from '@/lib/nav/from-link';
import { statusToneClass } from '@/lib/ui/status-tokens';

/** Join ReactNode parts with a " · " separator, dropping nullish/false parts.
 *  Used to compose stat sub-lines that interleave labels with <Money>. */
function joinDot(parts: ReactNode[]): ReactNode {
  const kept = parts.filter((p) => p != null && p !== false);
  if (kept.length === 0) return undefined;
  return kept.map((p, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: static positional join — index is the stable identity
    <Fragment key={i}>
      {i > 0 ? ' · ' : null}
      {p}
    </Fragment>
  ));
}

/** Smart-back hint passed to CO chips so the CO detail page can label
 * "Back to Budget" / "Back to Overview" rather than the generic referrer
 * fallback. Callers default to Budget — pass `{ tab: 'overview', label:
 * 'Overview' }` from overview-tab-server. */
type FromTab = { tab: string; label: string };
const DEFAULT_FROM_TAB: FromTab = { tab: 'budget', label: 'Budget' };

function coHref(projectId: string | undefined, coId: string, fromTab: FromTab): string {
  if (!projectId) return '#';
  return withFrom(
    `/projects/${projectId}/change-orders/${coId}`,
    `/projects/${projectId}?tab=${fromTab.tab}`,
    fromTab.label,
  );
}

type VarianceData = {
  estimated_cents: number;
  scope_subtotal_cents: number;
  lines_subtotal_cents: number;
  mgmt_fee_cents: number;
  mgmt_fee_rate: number;
  mgmt_fee_breakdown: {
    baseline_lines_cents: number;
    baseline_fee_cents: number;
    co_overrides: {
      co_id: string;
      cost_impact_cents: number;
      override_rate: number;
      fee_cents: number;
    }[];
    effective_rate: number;
  };
  envelope_total_cents: number;
  applied_co_impact_cents: number;
  pending_co_impact_cents: number;
  pending_co_count: number;
  committed_cents: number;
  committed_vendor_quotes_cents: number;
  committed_pos_cents: number;
  actual_bills_cents: number;
  actual_expenses_cents: number;
  actual_labour_cents: number;
  actual_total_cents: number;
  margin_at_risk_cents: number;
  by_category: {
    category: string;
    estimated_cents: number;
    committed_cents: number;
    actual_cents: number;
    margin_at_risk_cents: number;
  }[];
};

function StatBox({
  label,
  valueCents,
  sub,
  highlight,
  danger,
  success,
  href,
}: {
  label: string;
  valueCents: number;
  sub?: ReactNode;
  highlight?: boolean;
  danger?: boolean;
  success?: boolean;
  href?: string;
}) {
  const baseClass = `block rounded-xl border bg-card p-4 ${success ? 'bg-emerald-100/40 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : highlight ? 'bg-primary/5 border-primary/30' : ''} ${danger ? 'bg-red-100/40 border-red-200 dark:bg-red-900/20 dark:border-red-800' : ''}`;
  const valueToneClass = danger
    ? 'text-red-700 dark:text-red-300'
    : success
      ? 'text-emerald-700 dark:text-emerald-300'
      : highlight
        ? 'text-primary'
        : '';
  const inner = (
    <>
      <Eyebrow as="p">{label}</Eyebrow>
      <p className={`mt-1.5 text-lg font-semibold ${valueToneClass}`}>
        <Money cents={valueCents} />
      </p>
      {sub && (
        <Eyebrow as="p" className="mt-1 normal-case tracking-normal">
          {sub}
        </Eyebrow>
      )}
    </>
  );
  if (href) {
    return (
      <a href={href} className={`${baseClass} transition-colors hover:bg-muted/40`}>
        {inner}
      </a>
    );
  }
  return <div className={baseClass}>{inner}</div>;
}

type AnyCoSummary = {
  id: string;
  title: string;
  short_id: string;
  cost_impact_cents: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'declined' | 'voided';
  flow_version: 1 | 2;
  applied_at: string | null;
  approved_at: string | null;
  management_fee_override_rate: number | null;
  management_fee_override_reason: string | null;
  revenue_kind: 'applied' | 'approved_legacy' | 'pending' | 'other';
};

export function VarianceTab({
  variance,
  lifecycleStage,
  projectId,
  appliedChangeOrders = [],
  allChangeOrders = [],
  coContributionsByCategoryId = {},
  categoryIdByName = {},
  fromTab = DEFAULT_FROM_TAB,
}: {
  variance: VarianceData;
  lifecycleStage?: string;
  projectId?: string;
  fromTab?: FromTab;
  /** Audit lens — applied COs on this project. Used to (a) layer the
   *  total CO contribution into the Estimated Revenue stat, and (b)
   *  attach chips to category rows that were touched. */
  appliedChangeOrders?: {
    id: string;
    title: string;
    short_id: string;
    applied_at: string;
    cost_impact_cents: number;
  }[];
  /** Every CO on the project so the Revenue card can show v1 / pending /
   *  approved-not-applied COs alongside applied ones. */
  allChangeOrders?: AnyCoSummary[];
  coContributionsByCategoryId?: Record<string, AppliedChangeOrderContribution[]>;
  /** Variance by_category groups by category *name* (operator-typed) but
   *  CO contributions are keyed by id. This map bridges the two. */
  categoryIdByName?: Record<string, string>;
}) {
  const {
    estimated_cents,
    scope_subtotal_cents,
    mgmt_fee_cents,
    envelope_total_cents,
    applied_co_impact_cents,
    pending_co_impact_cents,
    pending_co_count,
    committed_cents,
    committed_vendor_quotes_cents,
    committed_pos_cents,
    actual_bills_cents,
    actual_expenses_cents,
    actual_labour_cents,
    actual_total_cents,
    margin_at_risk_cents,
    by_category,
    mgmt_fee_rate,
    mgmt_fee_breakdown,
  } = variance;
  const envelopeGapCents = estimated_cents - envelope_total_cents;
  // Override map: applied COs with a per-CO rate set, keyed for badging
  // the per-CO row + the breakdown audit panel.
  const overrideByCoId = new Map(mgmt_fee_breakdown.co_overrides.map((o) => [o.co_id, o]));
  const hasOverrides = mgmt_fee_breakdown.co_overrides.length > 0;
  const projectRatePct = (mgmt_fee_rate * 100).toFixed(2).replace(/\.?0+$/, '');
  const effectiveRatePct = (mgmt_fee_breakdown.effective_rate * 100)
    .toFixed(2)
    .replace(/\.?0+$/, '');
  // Original signed scope = current scope minus what applied COs added.
  // "Scope" = lines if a category itemizes, else its envelope, so this
  // captures envelope-only categories the customer signed for. Negative
  // would mean applied COs net-removed scope; we still show it as the
  // pre-CO baseline so the operator sees the layering.
  const originalLinesCents = scope_subtotal_cents - applied_co_impact_cents;

  const isComplete = lifecycleStage === 'complete';

  const marginPct =
    estimated_cents > 0
      ? Math.round(((estimated_cents - actual_total_cents) / estimated_cents) * 100)
      : null;

  // For closed projects costs are settled — only flag danger when actually over budget.
  // For in-flight projects, warn at >80% of estimate.
  const isAtRisk = isComplete
    ? margin_at_risk_cents < 0
    : actual_total_cents > estimated_cents * 0.8;

  const marginPositive = margin_at_risk_cents > 0;
  // "Projected Margin" while in flight (= revenue − spent − committed,
  // i.e. what you'll keep if commitments land at the committed cost).
  // "Realized Margin" once complete — same number, different framing.
  // Old label was "Margin at Risk" which sounded like *the slice
  // threatened*, but the math gives you the slice still safely yours.
  const marginLabel = isComplete ? 'Realized Margin' : 'Projected Margin';
  const marginSubLabel = isComplete ? 'final margin' : 'projected take-home';

  // Estimated stat sub-line shows the composition: scope subtotal + mgmt
  // fee, plus CO contribution if any have been applied. Uses scope
  // (lines-or-envelope) so the parts reconcile to the headline number
  // even when a category is priced at the envelope level.
  const coImpactCents = appliedChangeOrders.reduce((s, c) => s + c.cost_impact_cents, 0);
  const coCount = appliedChangeOrders.length;
  const estSub = joinDot([
    scope_subtotal_cents > 0 ? (
      <>
        Scope <Money cents={scope_subtotal_cents} />
      </>
    ) : null,
    mgmt_fee_cents > 0 ? (
      <>
        Mgmt fee <Money cents={mgmt_fee_cents} />
      </>
    ) : null,
    coCount ? (
      <>
        {coImpactCents >= 0 ? '+' : ''}
        <Money cents={coImpactCents} /> from {coCount} CO{coCount === 1 ? '' : 's'}
      </>
    ) : null,
  ]);

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  function toggleRow(name: string) {
    setExpandedRow((cur) => (cur === name ? null : name));
  }

  return (
    <div className="space-y-6">
      {/* Top-level summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Estimated Revenue" valueCents={estimated_cents} sub={estSub} highlight />
        <StatBox
          label="Projected Cost"
          valueCents={committed_cents}
          href={projectId ? `/projects/${projectId}?tab=costs&sub=quotes` : undefined}
        />
        <StatBox
          label="Actual Cost"
          valueCents={actual_total_cents}
          sub={joinDot([
            actual_labour_cents > 0 ? (
              <>
                Labour <Money cents={actual_labour_cents} />
              </>
            ) : null,
            actual_bills_cents > 0 ? (
              <>
                Bills <Money cents={actual_bills_cents} />
              </>
            ) : null,
            actual_expenses_cents > 0 ? (
              <>
                Expenses <Money cents={actual_expenses_cents} />
              </>
            ) : null,
          ])}
          danger={isAtRisk}
          href={
            projectId
              ? `/projects/${projectId}?tab=costs&sub=${actual_expenses_cents >= actual_bills_cents ? 'expenses' : 'bills'}`
              : undefined
          }
        />
        <StatBox
          label={marginLabel}
          valueCents={margin_at_risk_cents}
          sub={marginPct !== null ? `${marginPct}% ${marginSubLabel}` : undefined}
          danger={margin_at_risk_cents < 0}
          success={isComplete && marginPositive}
        />
      </div>

      {margin_at_risk_cents < 0 && (
        <div className="rounded-xl border border-red-200 bg-red-100 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          Actual costs exceed estimated revenue — this job is over budget.
        </div>
      )}

      {/* Full composition — every dollar of revenue / committed / spent
          with its source. The top StatBoxes are the headlines; this is
          the audit trail. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <CompositionCard
          title="Revenue"
          tone="primary"
          rows={[
            ...(originalLinesCents !== 0
              ? [{ label: 'Original scope', value: originalLinesCents }]
              : []),
            ...appliedChangeOrders.map((c) => {
              const ov = overrideByCoId.get(c.id);
              const overridePct = ov
                ? (ov.override_rate * 100).toFixed(2).replace(/\.?0+$/, '')
                : null;
              return {
                label: ov
                  ? `Applied CO: ${c.title} (${overridePct}% fee)`
                  : `Applied CO: ${c.title}`,
                value: c.cost_impact_cents,
                href: projectId ? coHref(projectId, c.id, fromTab) : undefined,
                badge: { kind: 'applied' as const },
              };
            }),
            ...(mgmt_fee_cents > 0
              ? hasOverrides
                ? [
                    {
                      label: `Management fee on baseline (${projectRatePct}%)`,
                      value: mgmt_fee_breakdown.baseline_fee_cents,
                    },
                    ...mgmt_fee_breakdown.co_overrides.map((o) => {
                      const co = appliedChangeOrders.find((c) => c.id === o.co_id);
                      const ratePct = (o.override_rate * 100).toFixed(2).replace(/\.?0+$/, '');
                      return {
                        label: `Management fee on ${co?.title ?? 'CO'} (${ratePct}% override)`,
                        value: o.fee_cents,
                      };
                    }),
                  ]
                : [{ label: `Management fee (${projectRatePct}%)`, value: mgmt_fee_cents }]
              : []),
          ]}
          total={{ label: 'Estimated revenue', value: estimated_cents }}
          footer={
            hasOverrides ? (
              <p className="text-sm text-muted-foreground">
                Effective management fee:{' '}
                <span className="font-medium text-foreground">{effectiveRatePct}%</span> (project
                default {projectRatePct}%).
              </p>
            ) : null
          }
          extraSection={(() => {
            const legacy = allChangeOrders.filter((c) => c.revenue_kind === 'approved_legacy');
            const pending = allChangeOrders.filter((c) => c.revenue_kind === 'pending');
            if (legacy.length === 0 && pending.length === 0) return null;
            return (
              <div className="mt-3 space-y-2 border-t pt-3 text-sm">
                {legacy.length > 0 ? (
                  <div>
                    <Eyebrow as="p" className="text-amber-800 dark:text-amber-300">
                      Approved but not applied to lines
                    </Eyebrow>
                    <ul className="mt-1.5 space-y-1">
                      {legacy.map((c) => (
                        <li key={c.id} className="flex items-baseline justify-between gap-3">
                          <a
                            href={coHref(projectId, c.id, fromTab)}
                            className="flex flex-1 items-baseline justify-between gap-2 hover:underline"
                          >
                            <span>
                              <span className="mr-1.5 inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-eyebrow font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                {c.flow_version === 1 ? 'v1' : 'unapplied'}
                              </span>
                              {c.title}
                            </span>
                            <Money
                              cents={c.cost_impact_cents}
                              signed
                              emphasis
                              className="text-amber-900 dark:text-amber-200"
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                    <Eyebrow as="p" className="mt-1.5 normal-case tracking-normal italic">
                      Customer agreed to these but cost lines may not reflect them. Verify line
                      items match the agreed scope.
                    </Eyebrow>
                  </div>
                ) : null}
                {pending.length > 0 ? (
                  <div>
                    <Eyebrow as="p">Pending customer approval</Eyebrow>
                    <ul className="mt-1.5 space-y-1">
                      {pending.map((c) => (
                        <li key={c.id} className="flex items-baseline justify-between gap-3">
                          <a
                            href={coHref(projectId, c.id, fromTab)}
                            className="flex flex-1 items-baseline justify-between gap-2 italic hover:underline"
                          >
                            <span>{c.title}</span>
                            <Money cents={c.cost_impact_cents} signed />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })()}
        />
        <CompositionCard
          title="Projected Cost"
          rows={[
            ...(committed_vendor_quotes_cents > 0
              ? [
                  {
                    label: 'Accepted vendor quotes',
                    value: committed_vendor_quotes_cents,
                    href: projectId ? `/projects/${projectId}?tab=costs&sub=quotes` : undefined,
                  },
                ]
              : []),
            ...(committed_pos_cents > 0
              ? [
                  {
                    label: 'Active purchase orders',
                    value: committed_pos_cents,
                    href: projectId ? `/projects/${projectId}?tab=costs&sub=pos` : undefined,
                  },
                ]
              : []),
          ]}
          total={{ label: 'Total committed', value: committed_cents }}
          footer={
            committed_cents === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No vendor quotes accepted or active POs yet.
              </p>
            ) : null
          }
        />
        <CompositionCard
          title="Spent"
          tone={isAtRisk ? 'danger' : undefined}
          rows={[
            ...(actual_labour_cents > 0
              ? [
                  {
                    label: 'Labour (time entries)',
                    value: actual_labour_cents,
                    href: projectId ? `/projects/${projectId}?tab=time` : undefined,
                  },
                ]
              : []),
            ...(actual_bills_cents > 0
              ? [
                  {
                    label: 'Bills',
                    value: actual_bills_cents,
                    href: projectId ? `/projects/${projectId}?tab=costs&sub=bills` : undefined,
                  },
                ]
              : []),
            ...(actual_expenses_cents > 0
              ? [
                  {
                    label: 'Expenses',
                    value: actual_expenses_cents,
                    href: projectId ? `/projects/${projectId}?tab=costs&sub=expenses` : undefined,
                  },
                ]
              : []),
          ]}
          total={{ label: 'Total spent', value: actual_total_cents }}
          footer={
            actual_total_cents === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No labour, bills, or expenses logged yet.
              </p>
            ) : null
          }
        />
      </div>

      {/* By-category breakdown — read-only. Click a row to expand the
          bills/expenses/POs/quotes split that drove the actuals. */}
      {by_category.length > 0 && (
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <Eyebrow as="h3">By Category · operator budget envelope</Eyebrow>
            <span className="text-sm text-muted-foreground">
              Sums to <Money cents={envelope_total_cents} />
              {envelopeGapCents !== 0 ? (
                <>
                  {' '}
                  · {envelopeGapCents > 0 ? '+' : ''}
                  <Money cents={envelopeGapCents} /> vs revenue
                </>
              ) : null}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-8 px-2 py-2" />
                  <Eyebrow as="th" className="px-3 py-2 text-left">
                    Category
                  </Eyebrow>
                  <Eyebrow as="th" className="px-3 py-2 text-right">
                    Estimated
                  </Eyebrow>
                  <Eyebrow as="th" className="px-3 py-2 text-right">
                    Projected Cost
                  </Eyebrow>
                  <Eyebrow as="th" className="px-3 py-2 text-right">
                    Actual
                  </Eyebrow>
                  <Eyebrow as="th" className="px-3 py-2 text-right">
                    Projected Margin
                  </Eyebrow>
                </tr>
              </thead>
              <tbody>
                {by_category.map((row) => {
                  const isOpen = expandedRow === row.category;
                  const catId = categoryIdByName[row.category];
                  const contribs = catId ? (coContributionsByCategoryId[catId] ?? []) : [];
                  const coChips = Array.from(new Map(contribs.map((c) => [c.co_id, c])).values());
                  return (
                    <Fragment key={row.category}>
                      <tr
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                        onClick={() => toggleRow(row.category)}
                      >
                        <td className="px-2 py-2 align-top text-muted-foreground">
                          {isOpen ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </td>
                        <td className="px-3 py-2 capitalize font-medium">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{row.category}</span>
                            {coChips.map((c) => (
                              <a
                                key={c.co_id}
                                href={coHref(projectId, c.co_id, fromTab)}
                                onClick={(e) => e.stopPropagation()}
                                title={`Touched by CO: ${c.co_title}`}
                                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-eyebrow font-semibold uppercase tracking-wide ${statusToneClass.info}`}
                              >
                                CO {c.co_short_id}
                              </a>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Money cents={row.estimated_cents} />
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          <Money cents={row.committed_cents} />
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          <Money cents={row.actual_cents} />
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${row.margin_at_risk_cents < 0 ? 'text-red-700 dark:text-red-300' : ''}`}
                        >
                          <Money cents={row.margin_at_risk_cents} />
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b bg-muted/20 last:border-0">
                          <td />
                          <td colSpan={5} className="px-3 py-3 text-xs">
                            <CategoryBreakdown
                              row={row}
                              projectId={projectId}
                              budgetCategoryId={catId}
                              coContributions={contribs}
                              fromTab={fromTab}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                <tr className="border-t bg-muted/30 font-semibold">
                  <td />
                  <td className="px-3 py-2">Envelope Total</td>
                  <td className="px-3 py-2 text-right">
                    <Money cents={envelope_total_cents} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money cents={committed_cents} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money cents={actual_total_cents} />
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${envelope_total_cents - actual_total_cents - committed_cents < 0 ? 'text-red-700 dark:text-red-300' : 'text-primary'}`}
                  >
                    <Money cents={envelope_total_cents - actual_total_cents - committed_cents} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {estimated_cents === 0 && actual_total_cents === 0 && (
        <p className="text-sm text-muted-foreground">
          No line items or bills recorded yet. Add line items in the Budget tab and log bills in the
          Spend tab.
        </p>
      )}
    </div>
  );
}

type CompositionRow = {
  label: string;
  value: number;
  href?: string;
  muted?: boolean;
  badge?: { kind: 'applied' };
};

function CompositionCard({
  title,
  tone,
  rows,
  total,
  footer,
  extraSection,
}: {
  title: string;
  tone?: 'primary' | 'danger';
  rows: CompositionRow[];
  total: { label: string; value: number };
  footer?: React.ReactNode;
  /** Optional extra block rendered between the total and the footer.
   *  Used for surfacing approved-but-not-applied / pending COs in the
   *  Revenue card without polluting the running total. */
  extraSection?: React.ReactNode;
}) {
  const totalToneClass =
    tone === 'danger' ? 'text-red-700 dark:text-red-300' : tone === 'primary' ? 'text-primary' : '';
  return (
    <div className="rounded-xl border bg-card p-4">
      <Eyebrow as="p" className="mb-2">
        {title}
      </Eyebrow>
      {rows.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => {
            const content = (
              <>
                <span className={r.muted ? 'text-muted-foreground' : ''}>{r.label}</span>
                <Money
                  cents={r.value}
                  emphasis={!r.muted}
                  className={r.muted ? 'text-muted-foreground' : ''}
                />
              </>
            );
            return (
              <li key={r.label} className="flex items-baseline justify-between gap-3">
                {r.href ? (
                  <a
                    href={r.href}
                    className="flex flex-1 items-baseline justify-between gap-3 hover:underline"
                  >
                    {content}
                  </a>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      <div
        className={`${rows.length > 0 ? 'mt-3 border-t pt-2' : ''} flex items-baseline justify-between gap-3 text-sm`}
      >
        <span className="font-semibold">{total.label}</span>
        <span className={`text-lg font-semibold ${totalToneClass}`}>
          <Money cents={total.value} />
        </span>
      </div>
      {extraSection}
      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  );
}

function CategoryBreakdown({
  row,
  projectId,
  budgetCategoryId,
  coContributions,
  fromTab = DEFAULT_FROM_TAB,
}: {
  row: VarianceData['by_category'][number];
  projectId?: string;
  budgetCategoryId?: string;
  coContributions: AppliedChangeOrderContribution[];
  fromTab?: FromTab;
}) {
  const tz = useTenantTimezone();
  const linkBase = projectId ? `/projects/${projectId}` : null;
  const focus = budgetCategoryId ? `&focus=${budgetCategoryId}` : '';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <BreakdownStat label="Estimated" cents={row.estimated_cents} />
        <BreakdownStat label="Committed" cents={row.committed_cents} />
        <BreakdownStat label="Actual" cents={row.actual_cents} />
        <BreakdownStat
          label="Projected Margin"
          cents={row.margin_at_risk_cents}
          danger={row.margin_at_risk_cents < 0}
        />
      </div>
      {coContributions.length > 0 ? (
        <div>
          <Eyebrow as="p" className="mb-1.5">
            Change Orders affecting this category
          </Eyebrow>
          <ul className="space-y-1 text-sm">
            {Array.from(new Map(coContributions.map((c) => [c.co_id, c])).values()).map((c) => (
              <li key={c.co_id} className="flex items-baseline justify-between gap-2">
                <a href={coHref(projectId, c.co_id, fromTab)} className="hover:underline">
                  <span
                    className={`mr-1.5 inline-flex items-center rounded-full border px-1.5 py-0.5 text-eyebrow font-semibold uppercase tracking-wide ${statusToneClass.info}`}
                  >
                    CO {c.co_short_id}
                  </span>
                  {c.co_title}
                </a>
                <span className="text-muted-foreground tabular-nums">
                  {new Intl.DateTimeFormat('en-CA', {
                    timeZone: tz,
                    month: 'short',
                    day: 'numeric',
                  }).format(new Date(c.applied_at))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {linkBase ? (
        <div className="flex flex-wrap gap-3 pt-1 text-sm">
          <a className="text-primary hover:underline" href={`${linkBase}?tab=budget${focus}`}>
            Open in Budget →
          </a>
          <a
            className="text-primary hover:underline"
            href={`${linkBase}?tab=costs&sub=bills${focus}`}
          >
            Bills →
          </a>
          <a
            className="text-primary hover:underline"
            href={`${linkBase}?tab=costs&sub=expenses${focus}`}
          >
            Expenses →
          </a>
          <a
            className="text-primary hover:underline"
            href={`${linkBase}?tab=costs&sub=pos${focus}`}
          >
            POs →
          </a>
          <a className="text-primary hover:underline" href={`${linkBase}?tab=time${focus}`}>
            Time →
          </a>
        </div>
      ) : null}
    </div>
  );
}

function BreakdownStat({
  label,
  cents,
  danger,
}: {
  label: string;
  cents: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card px-2 py-1.5">
      <Eyebrow as="p">{label}</Eyebrow>
      <p className={`text-sm font-medium ${danger ? 'text-red-700 dark:text-red-300' : ''}`}>
        <Money cents={cents} />
      </p>
    </div>
  );
}
