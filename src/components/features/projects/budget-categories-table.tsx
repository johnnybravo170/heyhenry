'use client';

/**
 * Budget scope table — ONE aligned grid (section → category → line sharing
 * the same columns), per the Project Hub budget OD. No nested sub-tables: a
 * cost line's value sits in the column that matches its state (Estimate always;
 * then Spent / Committed / Remaining). Sections collapse for scan and show an
 * estimate + over/projected-over summary when closed. Sticky column header.
 *
 * Shared component, two postures: authoring (planning — everything expanded for
 * build/price) and execution (active+ — collapsed, actuals-forward), switched
 * by `defaultExpanded` from the page. Inline edits, add/remove, drag-reorder,
 * per-line actuals, and CO chips are all preserved.
 *
 * Terminology: "Committed" (accepted sub-quotes + open POs) — NOT "Projected
 * Cost" (a different at-completion forecast concept).
 */

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CostLineActualsInline } from '@/components/features/projects/cost-line-actuals-inline';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import { Textarea } from '@/components/ui/textarea';
import type { AppliedChangeOrderContribution } from '@/lib/db/queries/change-orders';
import type { CostLineActualsSummary } from '@/lib/db/queries/cost-line-actuals';
import type { CostLineRow } from '@/lib/db/queries/cost-lines';
import type { MaterialsCatalogRow } from '@/lib/db/queries/materials-catalog';
import type { BudgetLine } from '@/lib/db/queries/project-budget-categories';
import { withFrom } from '@/lib/nav/from-link';
import { cn } from '@/lib/utils';
import {
  addBudgetCategoryAction,
  removeBudgetCategoryAction,
  renameSectionAction,
  reorderBudgetCategoriesAction,
  updateBudgetCategoryAction,
} from '@/server/actions/project-budget-categories';
import { deleteCostLineAction } from '@/server/actions/project-cost-control';
import { CostLineForm } from './cost-line-form';

/** Shared grid template — every row (head, section, category, line) aligns to it. */
const GRID = 'grid grid-cols-[24px_minmax(0,1fr)_110px_110px_110px_160px] items-center gap-x-2';

type BudgetCategoriesTableProps = {
  lines: BudgetLine[];
  projectId: string;
  costLines: CostLineRow[];
  catalog: MaterialsCatalogRow[];
  coContributionsByCategoryId?: Record<string, AppliedChangeOrderContribution[]>;
  actualsByLineId?: Record<string, CostLineActualsSummary>;
  /** Authoring posture (planning) → expanded; execution (active+) → collapsed. */
  defaultExpanded?: boolean;
  headerActions?: React.ReactNode;
};

/** spent/committed/over segments on a basis of max(estimate, spent+committed). */
function budgetSegments(estimate: number, spent: number, committed: number) {
  const used = spent + committed;
  const basis = Math.max(estimate, used, 1);
  const spentWithin = Math.min(spent, estimate);
  const spentOver = Math.max(0, spent - estimate);
  const afterSpent = Math.max(0, estimate - spent);
  const committedWithin = Math.min(committed, afterSpent);
  const committedOver = Math.max(0, committed - afterSpent);
  const pct = (n: number) => `${(n / basis) * 100}%`;
  const usedPct = estimate > 0 ? Math.round((used / estimate) * 100) : used > 0 ? 100 : 0;
  return {
    spentWithin: pct(spentWithin),
    spentOver: pct(spentOver),
    committedWithin: pct(committedWithin),
    committedOver: pct(committedOver),
    usedPct,
    actuallyOver: spent > estimate,
    projectedOver: spent <= estimate && used > estimate,
  };
}

/** The slim multi-segment progress bar shown in the Remaining column. */
function MiniBar({
  estimate,
  spent,
  committed,
}: {
  estimate: number;
  spent: number;
  committed: number;
}) {
  const s = budgetSegments(estimate, spent, committed);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {s.spentWithin !== '0%' ? (
          <span className="block h-full bg-foreground" style={{ width: s.spentWithin }} />
        ) : null}
        {s.spentOver !== '0%' ? (
          <span className="block h-full bg-destructive" style={{ width: s.spentOver }} />
        ) : null}
        {s.committedWithin !== '0%' ? (
          <span className="block h-full bg-[#7A6A4D]" style={{ width: s.committedWithin }} />
        ) : null}
        {s.committedOver !== '0%' ? (
          <span className="block h-full bg-destructive/50" style={{ width: s.committedOver }} />
        ) : null}
      </div>
      <span
        className={cn(
          'shrink-0 font-mono text-[11px] tabular-nums',
          s.actuallyOver
            ? 'text-destructive'
            : s.projectedOver
              ? 'text-amber-600'
              : 'text-muted-foreground',
        )}
      >
        {s.usedPct}%
      </span>
    </div>
  );
}

export function BudgetCategoriesTable({
  lines,
  projectId,
  costLines,
  catalog,
  coContributionsByCategoryId = {},
  actualsByLineId = {},
  defaultExpanded = true,
  headerActions,
}: BudgetCategoriesTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [editDescValue, setEditDescValue] = useState('');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    defaultExpanded ? new Set(lines.map((l) => l.budget_category_id)) : new Set(),
  );
  const allSections = useMemo(() => Array.from(new Set(lines.map((l) => l.section))), [lines]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() =>
    defaultExpanded ? new Set() : new Set(allSections),
  );
  const [addingLineFor, setAddingLineFor] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<CostLineRow | null>(null);
  const [addCategoryMode, setAddCategoryMode] = useState<'closed' | 'category' | 'section'>(
    'closed',
  );
  const [editingSectionName, setEditingSectionName] = useState<string | null>(null);
  const [editSectionValue, setEditSectionValue] = useState('');
  const [isPending, startTransition] = useTransition();
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const router = useRouter();
  const searchParams = useSearchParams();

  // Deep-link from Variance: ?focus=<category name> → expand its section +
  // category and highlight briefly.
  const focusName = searchParams?.get('focus');
  const focusCategoryId = useMemo(() => {
    if (!focusName) return null;
    const needle = focusName.toLowerCase().trim();
    return (
      lines.find((l) => l.budget_category_name.toLowerCase().trim() === needle)
        ?.budget_category_id ?? null
    );
  }, [focusName, lines]);
  const [highlight, setHighlight] = useState(false);
  useEffect(() => {
    if (!focusCategoryId) return;
    const focusLine = lines.find((l) => l.budget_category_id === focusCategoryId);
    if (focusLine) {
      setCollapsedSections((prev) => {
        const next = new Set(prev);
        next.delete(focusLine.section);
        return next;
      });
      setExpanded((prev) => new Set(prev).add(focusCategoryId));
    }
    setHighlight(true);
    const t = setTimeout(() => setHighlight(false), 2500);
    return () => clearTimeout(t);
  }, [focusCategoryId, lines]);

  // Optimistic drag order (same contract as before).
  const [localOrder, setLocalOrder] = useState<{ id: string; section: string }[] | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: lines identity is the reset trigger
  useEffect(() => {
    setLocalOrder(null);
  }, [lines]);

  const orderedLines = useMemo(() => {
    if (!localOrder) return lines;
    const byId = new Map(lines.map((l) => [l.budget_category_id, l]));
    return localOrder
      .map((o) => {
        const orig = byId.get(o.id);
        return orig ? { ...orig, section: o.section } : null;
      })
      .filter((x): x is BudgetLine => x !== null);
  }, [lines, localOrder]);

  const sections = new Map<string, BudgetLine[]>();
  for (const line of orderedLines) {
    const arr = sections.get(line.section) ?? [];
    arr.push(line);
    sections.set(line.section, arr);
  }

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const flat = orderedLines.map((l) => ({ id: l.budget_category_id, section: l.section }));
    const fromIdx = flat.findIndex((r) => r.id === activeId);
    if (fromIdx === -1) return;

    let next: { id: string; section: string }[];
    if (overId.startsWith('section:')) {
      const targetSection = overId.slice('section:'.length);
      const moved = { id: activeId, section: targetSection };
      const without = flat.filter((_, i) => i !== fromIdx);
      let last = -1;
      without.forEach((r, i) => {
        if (r.section === targetSection) last = i;
      });
      next = [...without.slice(0, last + 1), moved, ...without.slice(last + 1)];
    } else {
      const toIdx = flat.findIndex((r) => r.id === overId);
      if (toIdx === -1) return;
      const moved = { id: activeId, section: flat[toIdx].section };
      const without = flat.filter((_, i) => i !== fromIdx);
      const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
      next = [...without.slice(0, insertAt), moved, ...without.slice(insertAt)];
    }

    const previous = localOrder;
    setLocalOrder(next);
    startTransition(async () => {
      const res = await reorderBudgetCategoriesAction({ project_id: projectId, ordered: next });
      if (!res.ok) {
        setLocalOrder(previous);
        toast.error(res.error);
      }
    });
  }

  const linesByBudgetCategory = new Map<string, CostLineRow[]>();
  for (const cl of costLines) {
    if (!cl.budget_category_id || pendingDeletes.has(cl.id)) continue;
    const arr = linesByBudgetCategory.get(cl.budget_category_id) ?? [];
    arr.push(cl);
    linesByBudgetCategory.set(cl.budget_category_id, arr);
  }

  function toggleSection(section: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }
  function toggleExpand(categoryId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }
  function collapseAll() {
    setCollapsedSections(new Set(allSections));
    setExpanded(new Set());
  }

  function startEdit(line: BudgetLine) {
    setEditingId(line.budget_category_id);
    setEditValue(String(line.estimate_cents / 100));
  }
  function saveEdit(categoryId: string) {
    const cents = Math.round(Number(editValue) * 100);
    if (Number.isNaN(cents) || cents < 0) {
      toast.error('Invalid amount');
      return;
    }
    startTransition(async () => {
      const r = await updateBudgetCategoryAction({
        id: categoryId,
        project_id: projectId,
        estimate_cents: cents,
      });
      if (r.ok) {
        toast.success('Estimate updated');
        setEditingId(null);
      } else toast.error(r.error);
    });
  }
  function startEditDesc(line: BudgetLine) {
    setEditingDescId(line.budget_category_id);
    setEditDescValue(line.budget_category_description ?? '');
  }
  function saveEditDesc(categoryId: string) {
    startTransition(async () => {
      const r = await updateBudgetCategoryAction({
        id: categoryId,
        project_id: projectId,
        description: editDescValue.trim(),
      });
      if (r.ok) {
        toast.success('Description updated');
        setEditingDescId(null);
      } else toast.error(r.error);
    });
  }
  function startEditName(line: BudgetLine) {
    setEditingNameId(line.budget_category_id);
    setEditNameValue(line.budget_category_name);
  }
  function saveEditName(categoryId: string, originalName: string) {
    const trimmed = editNameValue.trim();
    if (!trimmed || trimmed === originalName) {
      setEditingNameId(null);
      return;
    }
    startTransition(async () => {
      const r = await updateBudgetCategoryAction({
        id: categoryId,
        project_id: projectId,
        name: trimmed,
      });
      if (r.ok) {
        toast.success('Category renamed');
        setEditingNameId(null);
      } else toast.error(r.error);
    });
  }
  function removeCategory(categoryId: string) {
    startTransition(async () => {
      const r = await removeBudgetCategoryAction({ id: categoryId, project_id: projectId });
      if (r.ok) toast.success('Category removed');
      else toast.error(r.error);
    });
  }

  function deleteLine(id: string) {
    const line = costLines.find((l) => l.id === id);
    if (!line) return;
    const hasDetail =
      (line.notes?.trim() ?? '').length > 0 || (line.photo_storage_paths?.length ?? 0) > 0;
    if (hasDetail) {
      const reasons = [
        (line.notes?.trim() ?? '').length > 0 ? 'notes' : null,
        (line.photo_storage_paths?.length ?? 0) > 0 ? 'photos' : null,
      ].filter(Boolean);
      if (!confirm(`This line has ${reasons.join(' and ')}. Delete anyway?`)) return;
      startTransition(async () => {
        await deleteCostLineAction(id, projectId);
      });
      return;
    }
    setPendingDeletes((prev) => new Set(prev).add(id));
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      deleteCostLineAction(id, projectId).then((res) => {
        if (!res.ok) {
          toast.error(res.error || "Couldn't delete line.");
          setPendingDeletes((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          router.refresh();
        }
      });
    }, 5000);
    toast('Line deleted', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          cancelled = true;
          clearTimeout(timer);
          setPendingDeletes((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      },
    });
  }

  const sectionEntries = Array.from(sections.entries());
  const categoryCount = lines.length;

  return (
    <DndContext sensors={dndSensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        {/* Scope head */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            Scope · {sectionEntries.length} section{sectionEntries.length === 1 ? '' : 's'} ·{' '}
            {categoryCount} categor{categoryCount === 1 ? 'y' : 'ies'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {headerActions}
            <Button size="sm" variant="ghost" onClick={collapseAll}>
              Collapse all
            </Button>
          </div>
        </div>

        {addCategoryMode !== 'closed' && (
          <AddBudgetCategoryForm
            projectId={projectId}
            existingSections={allSections.filter(Boolean)}
            defaultNewSection={addCategoryMode === 'section'}
            onDone={() => setAddCategoryMode('closed')}
          />
        )}

        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="min-w-[720px]">
            {/* Sticky column header */}
            <div
              className={cn(
                GRID,
                'sticky top-0 z-10 border-b bg-muted/60 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground',
              )}
            >
              <span />
              <span>Category</span>
              <span className="text-right">Estimate</span>
              <span className="text-right">Spent</span>
              <span className="text-right">Committed</span>
              <span className="text-right">Remaining</span>
            </div>

            {sectionEntries.map(([section, sectionLines]) => {
              const collapsed = collapsedSections.has(section);
              const estimate = sectionLines.reduce((s, l) => s + l.estimate_cents, 0);
              const spent = sectionLines.reduce((s, l) => s + l.actual_cents, 0);
              const committed = sectionLines.reduce((s, l) => s + l.committed_cents, 0);
              const seg = budgetSegments(estimate, spent, committed);
              // Collapsed-summary chips: categories over / projected-over.
              const overCats = sectionLines.filter((l) => l.actual_cents > l.estimate_cents);
              const projOverCats = sectionLines.filter(
                (l) =>
                  l.actual_cents <= l.estimate_cents &&
                  l.actual_cents + l.committed_cents > l.estimate_cents,
              );
              const isRenaming = editingSectionName === section;

              return (
                <SectionDroppable key={section} section={section}>
                  {/* Section row */}
                  <div className={cn(GRID, 'border-b px-3 py-2.5 hover:bg-muted/30')}>
                    <button
                      type="button"
                      onClick={() => toggleSection(section)}
                      aria-expanded={!collapsed}
                      aria-label={collapsed ? `Expand ${section}` : `Collapse ${section}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {collapsed ? (
                        <ChevronRight className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {isRenaming ? (
                        <Input
                          className="h-7 w-auto min-w-[180px] text-sm font-semibold uppercase tracking-wide"
                          value={editSectionValue}
                          onChange={(e) => setEditSectionValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') {
                              if (e.key === 'Enter') {
                                const t = editSectionValue.trim();
                                if (t && t !== section) {
                                  startTransition(async () => {
                                    const r = await renameSectionAction({
                                      project_id: projectId,
                                      old_name: section,
                                      new_name: t,
                                    });
                                    if (!r.ok) toast.error(r.error);
                                  });
                                }
                              }
                              setEditingSectionName(null);
                            }
                          }}
                          onBlur={() => setEditingSectionName(null)}
                          autoFocus
                          disabled={isPending}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSection(section)}
                          className="text-left text-sm font-semibold uppercase tracking-wide text-foreground"
                        >
                          {section}
                        </button>
                      )}
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {sectionLines.length} categor{sectionLines.length === 1 ? 'y' : 'ies'}
                      </span>
                      {!isRenaming ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditSectionValue(section);
                            setEditingSectionName(section);
                          }}
                          aria-label={`Rename ${section}`}
                          className="rounded p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="size-3" />
                        </button>
                      ) : null}
                      {/* Collapsed summary chips */}
                      {collapsed
                        ? overCats.map((l) => (
                            <span
                              key={l.budget_category_id}
                              className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
                            >
                              {l.budget_category_name} over{' '}
                              <Money cents={l.actual_cents - l.estimate_cents} />
                            </span>
                          ))
                        : null}
                      {collapsed
                        ? projOverCats.map((l) => (
                            <span
                              key={l.budget_category_id}
                              className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                            >
                              {l.budget_category_name} projected over
                            </span>
                          ))
                        : null}
                    </div>
                    <span className="text-right text-sm font-medium">
                      <Money cents={estimate} />
                    </span>
                    <span
                      className={cn(
                        'text-right text-sm font-medium',
                        seg.actuallyOver && 'text-destructive',
                      )}
                    >
                      <Money cents={spent} />
                    </span>
                    <span className="text-right text-sm text-muted-foreground">
                      {committed > 0 ? <Money cents={committed} /> : '—'}
                    </span>
                    <span>
                      <MiniBar estimate={estimate} spent={spent} committed={committed} />
                    </span>
                  </div>

                  {/* Category rows */}
                  {!collapsed ? (
                    <SortableContext
                      items={sectionLines.map((l) => l.budget_category_id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {sectionLines.map((line) => (
                        <BudgetCategoryRow
                          key={line.budget_category_id}
                          line={line}
                          isExpanded={expanded.has(line.budget_category_id)}
                          categoryLines={linesByBudgetCategory.get(line.budget_category_id) ?? []}
                          toggleExpand={toggleExpand}
                          editingId={editingId}
                          editValue={editValue}
                          setEditValue={setEditValue}
                          setEditingId={setEditingId}
                          isPending={isPending}
                          saveEdit={saveEdit}
                          startEdit={startEdit}
                          editingNameId={editingNameId}
                          editNameValue={editNameValue}
                          setEditNameValue={setEditNameValue}
                          setEditingNameId={setEditingNameId}
                          saveEditName={saveEditName}
                          startEditName={startEditName}
                          editingDescId={editingDescId}
                          editDescValue={editDescValue}
                          setEditDescValue={setEditDescValue}
                          setEditingDescId={setEditingDescId}
                          saveEditDesc={saveEditDesc}
                          startEditDesc={startEditDesc}
                          removeCategory={removeCategory}
                          addingLineFor={addingLineFor}
                          setAddingLineFor={setAddingLineFor}
                          editingLine={editingLine}
                          setEditingLine={setEditingLine}
                          deleteLine={deleteLine}
                          projectId={projectId}
                          catalog={catalog}
                          coContributions={
                            coContributionsByCategoryId[line.budget_category_id] ?? []
                          }
                          actualsByLineId={actualsByLineId}
                          showHighlight={highlight && line.budget_category_id === focusCategoryId}
                          isFocused={line.budget_category_id === focusCategoryId}
                        />
                      ))}
                    </SortableContext>
                  ) : null}
                </SectionDroppable>
              );
            })}

            {/* Add row footer */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setAddCategoryMode((m) => (m === 'category' ? 'closed' : 'category'))
                }
              >
                <Plus className="size-3.5" />
                {addCategoryMode === 'category' ? 'Cancel' : 'Add category'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAddCategoryMode((m) => (m === 'section' ? 'closed' : 'section'))}
              >
                <Plus className="size-3.5" />
                {addCategoryMode === 'section' ? 'Cancel' : 'Add section'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}

function SectionDroppable({ section, children }: { section: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `section:${section}` });
  return (
    <div ref={setNodeRef} className={cn(isOver && 'ring-2 ring-inset ring-primary/30')}>
      {children}
    </div>
  );
}

type BudgetCategoryRowProps = {
  line: BudgetLine;
  isExpanded: boolean;
  categoryLines: CostLineRow[];
  toggleExpand: (id: string) => void;
  editingId: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  setEditingId: (v: string | null) => void;
  isPending: boolean;
  saveEdit: (id: string) => void;
  startEdit: (line: BudgetLine) => void;
  editingNameId: string | null;
  editNameValue: string;
  setEditNameValue: (v: string) => void;
  setEditingNameId: (v: string | null) => void;
  saveEditName: (id: string, originalName: string) => void;
  startEditName: (line: BudgetLine) => void;
  editingDescId: string | null;
  editDescValue: string;
  setEditDescValue: (v: string) => void;
  setEditingDescId: (v: string | null) => void;
  saveEditDesc: (id: string) => void;
  startEditDesc: (line: BudgetLine) => void;
  removeCategory: (id: string) => void;
  addingLineFor: string | null;
  setAddingLineFor: (v: string | null) => void;
  editingLine: CostLineRow | null;
  setEditingLine: (v: CostLineRow | null) => void;
  deleteLine: (id: string) => void;
  projectId: string;
  catalog: MaterialsCatalogRow[];
  coContributions: AppliedChangeOrderContribution[];
  actualsByLineId: Record<string, CostLineActualsSummary>;
  showHighlight: boolean;
  isFocused: boolean;
};

function BudgetCategoryRow(props: BudgetCategoryRowProps) {
  const {
    line,
    isExpanded,
    categoryLines,
    toggleExpand,
    editingId,
    editValue,
    setEditValue,
    setEditingId,
    isPending,
    saveEdit,
    startEdit,
    editingNameId,
    editNameValue,
    setEditNameValue,
    setEditingNameId,
    saveEditName,
    startEditName,
    editingDescId,
    editDescValue,
    setEditDescValue,
    setEditingDescId,
    saveEditDesc,
    startEditDesc,
    removeCategory,
    addingLineFor,
    setAddingLineFor,
    editingLine,
    setEditingLine,
    deleteLine,
    projectId,
    catalog,
    coContributions,
    actualsByLineId,
    showHighlight,
    isFocused,
  } = props;

  const coChips = Array.from(new Map(coContributions.map((c) => [c.co_id, c])).values());
  const [expandedLineIds, setExpandedLineIds] = useState<Set<string>>(new Set());
  function toggleLineSpend(id: string) {
    setExpandedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: line.budget_category_id,
  });
  const rowRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    if (node && isFocused) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const style = { transform: CSS.Transform.toString(transform), transition };

  const editingThis = editingId === line.budget_category_id;

  return (
    <>
      <div
        ref={rowRef}
        style={style}
        {...attributes}
        className={cn(
          GRID,
          'border-b px-3 py-2 transition-colors',
          showHighlight && 'bg-primary/10 ring-2 ring-inset ring-primary/40',
          isDragging && 'relative z-20 bg-background opacity-90 shadow-md',
        )}
      >
        {/* twist + grip */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => toggleExpand(line.budget_category_id)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            className="text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </div>
        {/* name */}
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="group flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              {...listeners}
              aria-label={`Reorder ${line.budget_category_name}`}
              className="cursor-grab touch-none text-muted-foreground/40 hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-3.5" />
            </button>
            {editingNameId === line.budget_category_id ? (
              <Input
                className="h-7 w-auto min-w-[200px] text-sm"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    saveEditName(line.budget_category_id, line.budget_category_name);
                  if (e.key === 'Escape') setEditingNameId(null);
                }}
                onBlur={() => saveEditName(line.budget_category_id, line.budget_category_name)}
                autoFocus
                disabled={isPending}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => toggleExpand(line.budget_category_id)}
                  className="text-left text-sm hover:text-foreground"
                >
                  {line.budget_category_name}
                  {categoryLines.length > 0 ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {categoryLines.length} line{categoryLines.length === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => startEditName(line)}
                  aria-label="Rename category"
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                >
                  <Pencil className="size-3" />
                </button>
              </>
            )}
            {coChips.map((c) => (
              <a
                key={c.co_id}
                href={withFrom(
                  `/projects/${projectId}/change-orders/${c.co_id}`,
                  `/projects/${projectId}?tab=budget`,
                  'Budget',
                )}
                title={`Touched by CO: ${c.co_title}`}
                className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-800 hover:bg-blue-200"
              >
                CO {c.co_short_id}
              </a>
            ))}
          </div>
          {editingDescId === line.budget_category_id ? (
            <Textarea
              className="min-h-[4.5rem] resize-y text-xs"
              rows={3}
              value={editDescValue}
              onChange={(e) => setEditDescValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  saveEditDesc(line.budget_category_id);
                }
                if (e.key === 'Escape') setEditingDescId(null);
              }}
              onBlur={() => saveEditDesc(line.budget_category_id)}
              placeholder="Description (shown on estimate). Enter to save, Shift+Enter for new line."
              autoFocus
            />
          ) : line.budget_category_description ? (
            <button
              type="button"
              onClick={() => startEditDesc(line)}
              title={line.budget_category_description}
              className="line-clamp-1 text-left text-[11px] text-muted-foreground/80 hover:text-foreground"
            >
              {line.budget_category_description}
            </button>
          ) : null}
        </div>
        {/* estimate (editable when no priced lines) */}
        <span className="text-right text-sm">
          {editingThis ? (
            <Input
              type="number"
              step="0.01"
              className="h-7 w-full text-right text-sm"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit(line.budget_category_id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              onBlur={() => saveEdit(line.budget_category_id)}
              autoFocus
            />
          ) : line.lines_total_cents > 0 ? (
            <span title="Sum of priced cost lines. Edit a line to change this.">
              <Money cents={line.estimate_cents} />
            </span>
          ) : (
            <button
              type="button"
              className="hover:underline"
              onClick={() => startEdit(line)}
              title="Click to set an envelope estimate."
            >
              <Money cents={line.estimate_cents} />
            </button>
          )}
        </span>
        {/* spent */}
        <span
          className={cn(
            'text-right text-sm',
            line.actual_cents > line.estimate_cents && 'font-medium text-destructive',
          )}
        >
          {line.actual_cents > 0 ? <Money cents={line.actual_cents} /> : '—'}
        </span>
        {/* committed */}
        <span className="text-right text-sm text-muted-foreground">
          {line.committed_cents > 0 ? <Money cents={line.committed_cents} /> : '—'}
        </span>
        {/* remaining + bar */}
        <span>
          <MiniBar
            estimate={line.estimate_cents}
            spent={line.actual_cents}
            committed={line.committed_cents}
          />
          <span className="mt-0.5 flex items-center justify-end gap-1.5">
            <span
              className={cn(
                'text-right text-[11px]',
                line.actual_cents > line.estimate_cents
                  ? 'text-destructive'
                  : line.actual_cents + line.committed_cents > line.estimate_cents
                    ? 'text-amber-600'
                    : 'text-muted-foreground',
              )}
            >
              <Money cents={Math.abs(line.remaining_cents)} /> left
            </span>
            {categoryLines.length === 0 && !line.budget_category_description ? (
              <Button
                size="xs"
                variant="ghost"
                className="size-5 p-0 text-destructive hover:text-destructive"
                aria-label={`Remove ${line.budget_category_name}`}
                onClick={() => removeCategory(line.budget_category_id)}
                disabled={isPending}
              >
                <Trash2 className="size-3" />
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="size-5 p-0 text-destructive hover:text-destructive"
                    aria-label={`Remove ${line.budget_category_name}`}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {line.budget_category_name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {categoryLines.length > 0
                        ? `This category has ${categoryLines.length} cost line${categoryLines.length === 1 ? '' : 's'}. They'll be orphaned (kept on the project, unlinked) so no spend history is lost.`
                        : 'This category has a description that will be lost.'}{' '}
                      If time entries or expenses are linked, removal is blocked — reassign first.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => removeCategory(line.budget_category_id)}
                      disabled={isPending}
                      className="bg-destructive/10 text-destructive hover:bg-destructive/20"
                    >
                      Remove category
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </span>
        </span>
      </div>

      {/* Cost lines — same grid, value-by-column */}
      {isExpanded && !isDragging ? (
        <div className="border-b bg-muted/20">
          {categoryLines.map((cl) => {
            const a = actualsByLineId[cl.id];
            const spent = a ? a.labour_cents + a.bills_cents + a.expenses_cents : 0;
            const committed = a?.po_cents ?? 0;
            const remaining = cl.line_price_cents - spent - committed;
            const lineExpanded = expandedLineIds.has(cl.id);
            return (
              <div key={cl.id}>
                <div className={cn(GRID, 'px-3 py-1.5 hover:bg-muted/30')}>
                  <span />
                  <div className="flex min-w-0 flex-col">
                    <button
                      type="button"
                      onClick={() => toggleLineSpend(cl.id)}
                      className="flex items-start gap-1 text-left text-sm hover:text-foreground"
                      aria-expanded={lineExpanded}
                    >
                      {lineExpanded ? (
                        <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span>
                        {cl.label}
                        <span className="ml-1.5 text-[11px] text-muted-foreground/80">
                          {Number(cl.qty)} {cl.unit}
                          {cl.unit_price_cents > 0 ? (
                            <>
                              {' @ '}
                              <Money cents={cl.unit_price_cents} />
                            </>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLine(cl);
                      setAddingLineFor(null);
                    }}
                    className="text-right text-sm hover:underline"
                    title="Edit this line"
                  >
                    <Money cents={cl.line_price_cents} emphasis />
                  </button>
                  <span className="text-right text-sm text-muted-foreground">
                    {spent > 0 ? <Money cents={spent} /> : '—'}
                  </span>
                  <span className="text-right text-sm text-muted-foreground">
                    {committed > 0 ? <Money cents={committed} /> : '—'}
                  </span>
                  <span className="flex items-center justify-end gap-1 text-right text-sm text-muted-foreground">
                    {remaining !== 0 ? (
                      <span className={cn(remaining < 0 && 'text-destructive')}>
                        <Money cents={Math.abs(remaining)} />
                      </span>
                    ) : (
                      '—'
                    )}
                    <button
                      type="button"
                      onClick={() => deleteLine(cl.id)}
                      aria-label={`Delete ${cl.label}`}
                      className="rounded p-0.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                </div>
                {lineExpanded ? (
                  <div className="bg-muted/30 px-3 py-2 pl-9">
                    <CostLineActualsInline
                      projectId={projectId}
                      costLineId={cl.id}
                      costLineLabel={cl.label}
                      actuals={actualsByLineId[cl.id]}
                    />
                  </div>
                ) : null}
                {editingLine?.id === cl.id ? (
                  <div className="bg-muted/40 px-3 py-3 pl-9">
                    <CostLineForm
                      projectId={projectId}
                      initial={editingLine}
                      catalog={catalog}
                      defaultCategoryId={line.budget_category_id}
                      onDone={() => setEditingLine(null)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* cl-actions: add line + spent-by-source */}
          <div className="flex flex-wrap items-center gap-3 px-3 py-2 pl-9">
            {addingLineFor === line.budget_category_id ? (
              <div className="w-full">
                <CostLineForm
                  projectId={projectId}
                  catalog={catalog}
                  defaultCategoryId={line.budget_category_id}
                  seedPriceCents={categoryLines.length === 0 ? line.estimate_cents : undefined}
                  onDone={() => setAddingLineFor(null)}
                />
              </div>
            ) : (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setAddingLineFor(line.budget_category_id);
                    setEditingLine(null);
                  }}
                >
                  <Plus className="size-3" />
                  Add line
                </Button>
                {line.labor_cents > 0 || line.bills_cents > 0 || line.expense_cents > 0 ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      Spent by source
                    </span>
                    {line.labor_cents > 0 ? (
                      <Link
                        href={`/projects/${projectId}?tab=time&focus=${line.budget_category_id}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Labour{' '}
                        <Money cents={line.labor_cents} className="font-medium text-foreground" />
                      </Link>
                    ) : null}
                    {line.bills_cents > 0 ? (
                      <Link
                        href={`/projects/${projectId}?tab=costs&focus=${line.budget_category_id}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Bills{' '}
                        <Money cents={line.bills_cents} className="font-medium text-foreground" />
                      </Link>
                    ) : null}
                    {line.expense_cents > 0 ? (
                      <Link
                        href={`/projects/${projectId}?tab=costs&focus=${line.budget_category_id}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Expenses{' '}
                        <Money cents={line.expense_cents} className="font-medium text-foreground" />
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function AddBudgetCategoryForm({
  projectId,
  existingSections,
  onDone,
  defaultNewSection = false,
}: {
  projectId: string;
  existingSections: string[];
  onDone: () => void;
  defaultNewSection?: boolean;
}) {
  const [name, setName] = useState('');
  const initialIsCustom = defaultNewSection || existingSections.length === 0;
  const [section, setSection] = useState(initialIsCustom ? '' : (existingSections[0] ?? ''));
  const [isCustomSection, setIsCustomSection] = useState(initialIsCustom);
  const [estimate, setEstimate] = useState('');
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    const sectionTrimmed = section.trim();
    if (!sectionTrimmed) {
      toast.error('Section is required');
      return;
    }
    const estimate_cents = Math.round(parseFloat(estimate || '0') * 100);
    startTransition(async () => {
      const r = await addBudgetCategoryAction({
        project_id: projectId,
        name: name.trim(),
        section: sectionTrimmed,
        estimate_cents,
        description: description.trim() || undefined,
      });
      if (r.ok) {
        toast.success('Category added');
        onDone();
      } else toast.error(r.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-muted/30 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="add-category-name" className="mb-1 block text-xs font-medium">
            Name
          </label>
          <Input
            id="add-category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kitchen"
            required
          />
        </div>
        <div>
          <label htmlFor="add-category-section" className="mb-1 block text-xs font-medium">
            Section
          </label>
          {isCustomSection ? (
            <div className="flex items-center gap-2">
              <Input
                id="add-category-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="New section name"
                autoFocus
              />
              {existingSections.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomSection(false);
                    setSection(existingSections[0] ?? '');
                  }}
                  className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  ← Pick existing
                </button>
              ) : null}
            </div>
          ) : (
            <select
              id="add-category-section"
              value={section}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setIsCustomSection(true);
                  setSection('');
                } else setSection(e.target.value);
              }}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {existingSections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="__new__">+ New section…</option>
            </select>
          )}
        </div>
        <div>
          <label htmlFor="add-category-estimate" className="mb-1 block text-xs font-medium">
            Estimate ($)
          </label>
          <Input
            id="add-category-estimate"
            type="number"
            step="0.01"
            min="0"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="sm:col-span-4">
          <label htmlFor="add-category-description" className="mb-1 block text-xs font-medium">
            Description{' '}
            <span className="text-muted-foreground">(optional — shown on estimate)</span>
          </label>
          <Textarea
            id="add-category-description"
            rows={3}
            className="min-h-[4.5rem] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Demo existing tile, prep subfloor, install LVP"
          />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Adding…' : 'Add category'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
