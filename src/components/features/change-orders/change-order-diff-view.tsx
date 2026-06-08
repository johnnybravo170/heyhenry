import { Money } from '@/components/ui/money';
import type { ChangeOrderLineRow } from '@/lib/db/queries/change-orders';
import { changeOrderLineDelta } from '@/lib/ui/change-order-action';
import { ChangeOrderActionChip } from './change-order-action-chip';

type CategoryNote = { budget_category_id: string; note: string };

/**
 * Before → After → Δ line-level diff. Rendered identically on the operator
 * CO detail and the customer-facing public `/approve` page (price-only). The
 * action pills come from the intentional diff-action palette
 * (`change-order-action.ts`), SEPARATE from lifecycle status-tokens — one
 * tone + label + glyph per edit type.
 */
export function ChangeOrderDiffView({
  diffLines,
  categoryNotes,
  budgetCategoryNamesById,
}: {
  diffLines: ChangeOrderLineRow[];
  categoryNotes: CategoryNote[];
  budgetCategoryNamesById: Record<string, string>;
}) {
  const hasNotes = categoryNotes.length > 0;
  const hasLines = diffLines.length > 0;
  if (!hasNotes && !hasLines) return null;

  return (
    <div className="space-y-4">
      {hasLines ? (
        <div className="overflow-hidden rounded-lg border">
          <p className="border-b bg-muted/50 px-4 py-2 font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Line-level changes
          </p>
          <div className="overflow-x-auto">
            {/* table-fixed + colgroup so numeric cols are anchored on the */}
            {/* right and the Line description absorbs slack. */}
            <table className="w-full min-w-[640px] table-fixed text-sm">
              <colgroup>
                <col className="w-28" />
                <col />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-24" />
              </colgroup>
              <thead className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium">Line</th>
                  <th className="px-3 py-2 text-right font-medium">Before</th>
                  <th className="px-3 py-2 text-right font-medium">After</th>
                  <th className="px-3 py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {diffLines.map((d) => {
                  const { beforeCents, afterCents, deltaCents } = changeOrderLineDelta(d);
                  const before = d.before_snapshot as { label?: string } | null;
                  const label =
                    d.action === 'modify_envelope'
                      ? `Budget: ${d.label ?? '—'}`
                      : (d.label ?? before?.label ?? '—');
                  return (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 align-top">
                        <ChangeOrderActionChip action={d.action} />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div
                          className={
                            d.action === 'remove' ? 'line-through decoration-red-400' : undefined
                          }
                        >
                          {label}
                        </div>
                        {d.notes ? (
                          <div className="mt-0.5 text-xs italic text-muted-foreground">
                            {d.notes}
                          </div>
                        ) : null}
                        {d.budget_category_id ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {budgetCategoryNamesById[d.budget_category_id] ?? ''}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        {d.action === 'add' ? (
                          <span className="text-muted-foreground/50">—</span>
                        ) : (
                          <Money cents={beforeCents} className="text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        {d.action === 'remove' ? (
                          <span className="text-muted-foreground/50">—</span>
                        ) : (
                          <Money cents={afterCents} />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <Money cents={deltaCents} signed className="font-semibold" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {hasNotes ? (
        <div className="rounded-lg border p-4">
          <p className="mb-3 font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Notes by category
          </p>
          <ul className="space-y-2 text-sm">
            {categoryNotes.map((n) => (
              <li key={n.budget_category_id}>
                <span className="font-medium">
                  {budgetCategoryNamesById[n.budget_category_id] ?? n.budget_category_id}
                </span>
                <span className="ml-2 italic text-muted-foreground">{n.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
