'use client';

/**
 * Operator-side list of project selections, grouped by room. Each room
 * carries an allowance-vs-actual roll-up; each row shows its per-selection
 * variance (label, never colour-only), a dual-authoring "by" tag, and — on
 * over-allowance rows — a "Start CO" affordance that links to the Change-
 * Order creation path prefilled with the selection's context.
 *
 * The variance logic is pure + unit-tested in `@/lib/selections/variance`;
 * the pills render via `selection-variance-ui`. Rows collapse into the
 * Selections tab on the project detail page.
 */

import { ArrowUpRight, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import type { ProjectSelection } from '@/lib/db/queries/project-selections';
import { rollupVariance, selectionVariance } from '@/lib/selections/variance';
import {
  type SelectionCategory,
  selectionCategoryLabels,
} from '@/lib/validators/project-selection';
import { deleteSelectionAction } from '@/server/actions/project-selections';
import { SelectionFormDialog } from './selection-form-dialog';
import { type GalleryPickerPhoto, SelectionPhotoPicker } from './selection-photo-picker';
import { ByTag, VarianceDelta } from './selection-variance-ui';

/**
 * Build the "Start CO" href for an over-allowance selection. Links to the
 * real Change-Order creation route, prefilled with a title + reason drawn
 * from the selection so the operator starts from context. The CO is still
 * human-authored + approved — this only seeds the text fields.
 */
function startCoHref(projectId: string, sel: ProjectSelection, overLabel: string): string {
  const what = [sel.brand, sel.name].filter(Boolean).join(' ') || sel.room;
  const title = `${sel.room}: ${what} over allowance`;
  const reason = `Selection "${what}" (${sel.room}) is ${overLabel}. Recovering the over-allowance cost as a change to scope.`;
  const params = new URLSearchParams({ from: 'selection', title, reason });
  return `/projects/${projectId}/change-orders/new?${params.toString()}`;
}

export function SelectionList({
  groups,
  projectId,
  galleryPhotos = [],
  promotedSelectionIds = new Set(),
}: {
  groups: Array<{ room: string; items: ProjectSelection[] }>;
  projectId: string;
  galleryPhotos?: GalleryPickerPhoto[];
  /** IDs of selections promoted from a client idea (render the by-promoted tag). */
  promotedSelectionIds?: Set<string>;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No selections yet — catalog the paint codes, tile SKUs, and fixtures going in each room.
        They&rsquo;ll appear in the client&rsquo;s portal and the final Property Record.
      </p>
    );
  }

  // Project-level roll-up across every selection (the headline number).
  const allItems = groups.flatMap((g) => g.items);
  const projectRollup = rollupVariance(allItems, 'Project');

  return (
    <div className="space-y-6">
      <ProjectRollup rollup={projectRollup} />

      {groups.map((group) => {
        const roomRollup = rollupVariance(group.items, 'Room');
        return (
          <div key={group.room} className="rounded-lg border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
              <h3 className="text-sm font-semibold">{group.room}</h3>
              <span className="text-xs text-muted-foreground">
                {group.items.length} {group.items.length === 1 ? 'selection' : 'selections'}
              </span>
              <VarianceDelta tone={roomRollup.tone} label={roomRollup.label} />
              <div className="ml-auto">
                <SelectionFormDialog
                  projectId={projectId}
                  defaultRoom={group.room}
                  trigger={
                    <button
                      type="button"
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      + Add to this room
                    </button>
                  }
                />
              </div>
            </div>
            <ul className="divide-y">
              {group.items.map((sel) => (
                <SelectionRow
                  key={sel.id}
                  selection={sel}
                  projectId={projectId}
                  galleryPhotos={galleryPhotos}
                  promoted={promotedSelectionIds.has(sel.id)}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ProjectRollup({ rollup }: { rollup: ReturnType<typeof rollupVariance> }) {
  return (
    <section
      aria-label="Allowance vs actual roll-up across all rooms"
      className="rounded-lg border bg-card p-4"
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total allowance
          </p>
          <p className="mt-0.5 font-mono text-base font-semibold">
            <Money cents={rollup.totalAllowanceCents} />
          </p>
        </div>
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Actual to date
          </p>
          <p className="mt-0.5 font-mono text-base font-semibold">
            <Money cents={rollup.totalActualCents} />
          </p>
          <p className="text-xs text-muted-foreground">
            {rollup.pricedCount} of {rollup.selectionCount} priced
          </p>
        </div>
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Net variance
          </p>
          <div className="mt-0.5">
            <VarianceDelta tone={rollup.tone} label={rollup.label} />
          </div>
        </div>
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Over allowance
          </p>
          <p className="mt-0.5 text-sm">
            {rollup.overCount > 0 ? (
              <span className="font-medium text-rose-800 dark:text-rose-300">
                {rollup.overCount} {rollup.overCount === 1 ? 'selection' : 'selections'} over
              </span>
            ) : (
              <span className="text-muted-foreground">None over</span>
            )}
          </p>
        </div>
      </div>
      <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
        Allowances live on each selection · variance is per-row, not netted. Over-allowance is the
        Change-Order trigger.
      </p>
    </section>
  );
}

function SelectionRow({
  selection,
  projectId,
  galleryPhotos = [],
  promoted = false,
}: {
  selection: ProjectSelection;
  projectId: string;
  galleryPhotos?: GalleryPickerPhoto[];
  promoted?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete "${selection.name ?? selection.category}" from ${selection.room}?`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteSelectionAction(selection.id, projectId);
      if (!res.ok) toast.error(res.error);
    });
  }

  const headline = [selection.brand, selection.name].filter(Boolean).join(' ');
  const detail = [selection.code, selection.finish].filter(Boolean).join(' • ');
  const variance = selectionVariance(selection.allowance_cents, selection.actual_cost_cents);
  const isOver = variance?.isOverAllowance ?? false;

  return (
    <li
      className={`flex items-start gap-3 px-4 py-3 ${
        isOver ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {selectionCategoryLabels[selection.category as SelectionCategory] ?? selection.category}
          </span>
          {headline ? <span className="text-sm font-medium">{headline}</span> : null}
          <ByTag createdBy={selection.created_by} promoted={promoted} />
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {detail ? <span>{detail}</span> : null}
          {selection.supplier ? <span>{selection.supplier}</span> : null}
          {selection.sku ? <span className="font-mono">SKU {selection.sku}</span> : null}
        </div>
        {selection.notes ? (
          <p className="mt-1 text-xs text-muted-foreground">{selection.notes}</p>
        ) : null}
      </div>

      {/* Allowance vs actual — the headline pair. */}
      {variance ? (
        <div className="flex flex-col items-end gap-1 text-right">
          {selection.allowance_cents != null ? (
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                Allowance
              </span>
              <Money cents={selection.allowance_cents} className="text-sm font-mono" />
            </div>
          ) : null}
          {selection.actual_cost_cents != null ? (
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                Actual
              </span>
              <Money
                cents={selection.actual_cost_cents}
                className={`text-sm font-mono ${isOver ? 'font-bold text-rose-800 dark:text-rose-300' : ''}`}
              />
            </div>
          ) : null}
          <VarianceDelta tone={variance.tone} label={variance.label} />
          {isOver ? (
            <Button
              asChild
              size="sm"
              variant="destructive"
              className="mt-1 h-7 gap-1 px-2.5 text-xs font-bold uppercase tracking-wide"
            >
              <Link href={startCoHref(projectId, selection, variance.label)}>
                <ArrowUpRight className="size-3" aria-hidden />
                Start CO
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        {galleryPhotos.length > 0 ? (
          <SelectionPhotoPicker
            selectionId={selection.id}
            projectId={projectId}
            photos={galleryPhotos}
            initialIds={selection.photo_refs.map((r) => r.photo_id)}
            count={selection.photo_refs.length}
          />
        ) : null}
        <SelectionFormDialog
          projectId={projectId}
          selection={selection}
          trigger={
            <Button type="button" size="icon" variant="ghost" aria-label="Edit selection">
              <Pencil className="size-4" />
            </Button>
          }
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Delete selection"
          onClick={onDelete}
          disabled={pending}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
