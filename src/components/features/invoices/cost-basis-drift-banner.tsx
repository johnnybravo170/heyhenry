import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Money } from '@/components/ui/money';
import { statusToneClass } from '@/lib/ui/status-tokens';

/**
 * Reconciliation caution on the draft cost-plus invoice. Compares the
 * pre-tax cost basis the invoice was billed against (frozen in
 * `line_items` at creation time) to the project's current cost rollup
 * (live read of time_entries + expenses + project_bills via the same
 * helper the action used). A non-zero delta means either:
 *   (a) more cost was logged after the draft was created — regenerate, or
 *   (b) the helper now sees a cost source the breakdown math doesn't —
 *       investigate before sending.
 *
 * Only renders on cost-plus drafts. Restyled (UX redesign) from a full
 * amber banner to an inline warn-soft caution — the customer-view preview
 * is the hero, this is a side-note. Same warn-soft + left-border Henry
 * chrome family as `ScheduleSlipPrompt`.
 */
export function CostBasisDriftBanner({
  projectId,
  billedCostBasisCents,
  currentCostBasisCents,
}: {
  projectId: string;
  /** Sum of the invoice's Labour + Materials line items. */
  billedCostBasisCents: number;
  /** What the helper says the basis would be today. */
  currentCostBasisCents: number;
}) {
  const delta = currentCostBasisCents - billedCostBasisCents;
  const direction = delta > 0 ? 'higher' : 'lower';

  return (
    <div
      className={`flex items-start gap-3 rounded-r-lg border border-l-2 border-l-brand p-3 ${statusToneClass.warning}`}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col gap-1 text-sm leading-snug">
        <p>
          <span className="font-semibold">Cost basis has drifted from this draft.</span> Billed{' '}
          <Money cents={billedCostBasisCents} className="font-medium" /> · today&rsquo;s rollup{' '}
          <Money cents={currentCostBasisCents} className="font-medium" /> —{' '}
          <Money cents={Math.abs(delta)} className="font-medium" /> {direction}. Regenerate the
          draft, or open the budget to see which entries differ.
        </p>
        <Link
          href={`/projects/${projectId}?tab=budget`}
          className="font-medium underline underline-offset-2"
        >
          Open project budget
        </Link>
      </div>
    </div>
  );
}
