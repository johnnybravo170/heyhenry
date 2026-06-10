'use client';

/**
 * Budget scope table — each SECTION is a free-standing heading that sits above
 * its OWN bordered card; a single global column header (Category / Estimate /
 * Spent / Committed / Remaining) sits above all sections. No nested sub-tables:
 * a cost line's value sits in the column that matches its state (Estimate always;
 * then Spent / Committed / Remaining). Sections collapse for scan and show an
 * estimate + over/projected-over summary on the heading when closed.
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
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
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
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import type { AppliedChangeOrderContribution } from '@/lib/db/queries/change-orders';
import type { CostLineActualsSummary } from '@/lib/db/queries/cost-line-actuals';
import type { CostLineRow } from '@/lib/db/queries/cost-lines';
import type { MaterialsCatalogRow } from '@/lib/db/queries/materials-catalog';
import type { BudgetLine, BudgetSection } from '@/lib/db/queries/project-budget-categories';
import { withFrom } from '@/lib/nav/from-link';
import { cn } from '@/lib/utils';
import {
  addBudgetCategoryAction,
  createBudgetSectionAction,
  deleteBudgetSectionAction,
  draftBudgetSectionDescriptionAction,
  removeBudgetCategoryAction,
  reorderBudgetCategoriesAction,
  updateBudgetCategoryAction,
  updateBudgetSectionAction,
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
  /**
   * All sections for the project in render order (incl. EMPTY ones). When
   * provided, drives section order + lets newly-created empty sections render
   * before any category lands in them. When omitted, section order is derived
   * from the lines' own `section_entity` (empty sections won't show until a
   * reload that includes them).
   */
  sections?: BudgetSection[];
};

/** A section header descriptor the table renders, with its member lines. */
type SectionGroup = {
  entity: BudgetSection;
  lines: BudgetLine[];
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
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ECE3D0]">
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
          <span className="block h-full bg-destructive" style={{ width: s.committedOver }} />
        ) : null}
      </div>
      <span
        className={cn(
          'shrink-0 font-mono text-eyebrow tabular-nums',
          s.actuallyOver
            ? 'text-destructive'
            : s.projectedOver
              ? 'text-amber-700 dark:text-amber-300'
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
  sections: sectionsProp,
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
  // Section render order. Prefer the explicit `sections` prop (includes empty
  // sections); otherwise derive from the lines' section entities, ordered by
  // sort_order with "Other" (sort_order Infinity) last.
  const orderedSectionEntities = useMemo<BudgetSection[]>(() => {
    if (sectionsProp) return sectionsProp;
    const byKey = new Map<string, BudgetSection>();
    for (const l of lines) {
      const key = l.section_entity.id ?? '__other__';
      if (!byKey.has(key)) byKey.set(key, l.section_entity);
    }
    return Array.from(byKey.values()).sort((a, b) => a.sort_order - b.sort_order);
  }, [sectionsProp, lines]);
  const allSections = useMemo(
    () => orderedSectionEntities.map((s) => s.name),
    [orderedSectionEntities],
  );
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() =>
    defaultExpanded ? new Set() : new Set(allSections),
  );
  const [addingLineFor, setAddingLineFor] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<CostLineRow | null>(null);
  const [addCategoryMode, setAddCategoryMode] = useState<'closed' | 'category' | 'section'>(
    'closed',
  );
  // Contextual "+ Add category to {section}" target. When set, the inline form
  // renders nested under that section with the Section picker pre-filled/hidden.
  const [addCategoryForSection, setAddCategoryForSection] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState<string | null>(null);
  const [editSectionValue, setEditSectionValue] = useState('');
  // Inline section-description editing, keyed by section id. "Other" (id null)
  // is synthetic and has no description.
  const [editingSectionDescId, setEditingSectionDescId] = useState<string | null>(null);
  const [editSectionDescValue, setEditSectionDescValue] = useState('');
  // Section id currently being drafted by Henry (✦ Draft from line items).
  const [draftingSectionId, setDraftingSectionId] = useState<string | null>(null);
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
        next.delete(focusLine.section_entity.name);
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

  // Section entity lookup by name, so an optimistic drag (which carries only
  // the target section NAME) can re-point a line's section_entity for grouping.
  const sectionEntityByName = useMemo(() => {
    const m = new Map<string, BudgetSection>();
    for (const s of orderedSectionEntities) m.set(s.name, s);
    return m;
  }, [orderedSectionEntities]);

  const orderedLines = useMemo(() => {
    if (!localOrder) return lines;
    const byId = new Map(lines.map((l) => [l.budget_category_id, l]));
    return localOrder
      .map((o) => {
        const orig = byId.get(o.id);
        if (!orig) return null;
        const entity = sectionEntityByName.get(o.section) ?? orig.section_entity;
        return { ...orig, section: o.section, section_entity: entity };
      })
      .filter((x): x is BudgetLine => x !== null);
  }, [lines, localOrder, sectionEntityByName]);

  // Group lines by section entity, then emit groups in render order. Empty
  // sections (from the `sections` prop) still get a group so they render.
  const linesBySectionName = new Map<string, BudgetLine[]>();
  for (const line of orderedLines) {
    const key = line.section_entity.name;
    const arr = linesBySectionName.get(key) ?? [];
    arr.push(line);
    linesBySectionName.set(key, arr);
  }
  const sectionGroups: SectionGroup[] = orderedSectionEntities.map((entity) => ({
    entity,
    lines: linesBySectionName.get(entity.name) ?? [],
  }));
  // Defensive: any section name present on a line but missing from the
  // ordered-entity list (shouldn't happen, but keeps lines from vanishing).
  for (const [name, groupLines] of linesBySectionName) {
    if (!orderedSectionEntities.some((s) => s.name === name)) {
      sectionGroups.push({ entity: groupLines[0].section_entity, lines: groupLines });
    }
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

    const flat = orderedLines.map((l) => ({
      id: l.budget_category_id,
      section: l.section_entity.name,
    }));
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
  function expandAll() {
    setCollapsedSections(new Set());
    setExpanded(new Set(lines.map((l) => l.budget_category_id)));
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

  function removeSection(sectionId: string) {
    startTransition(async () => {
      const r = await deleteBudgetSectionAction({ id: sectionId, project_id: projectId });
      if (r.ok) {
        toast.success('Section deleted');
        router.refresh();
      } else {
        toast.error(r.error);
      }
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

  const sectionEntries = sectionGroups;
  // State-aware expand/collapse: if every section is collapsed (and nothing is
  // expanded), the only useful action is "Expand all"; otherwise "Collapse all".
  const allCollapsed =
    allSections.length > 0 &&
    allSections.every((s) => collapsedSections.has(s)) &&
    expanded.size === 0;

  return (
    <DndContext sensors={dndSensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        {/* Scope head */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="ml-auto flex items-center gap-2">
            {headerActions}
            <Button
              size="sm"
              variant="ghost"
              onClick={allCollapsed ? expandAll : collapseAll}
              aria-pressed={!allCollapsed}
            >
              {allCollapsed ? (
                <Maximize2 className="size-3.5" />
              ) : (
                <Minimize2 className="size-3.5" />
              )}
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </Button>
          </div>
        </div>

        {addCategoryMode !== 'closed' && (
          <AddBudgetCategoryForm
            projectId={projectId}
            kind={addCategoryMode === 'section' ? 'section' : 'category'}
            existingSections={allSections.filter(Boolean)}
            onDone={() => setAddCategoryMode('closed')}
          />
        )}

        <div className="overflow-x-auto">
          <div className="min-w-[720px] space-y-3">
            {sectionEntries.map(({ entity, lines: sectionLines }) => {
              const section = entity.name;
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
              // "Other" (id null) is synthetic — no entity to rename/describe.
              const isRealSection = entity.id !== null;
              const isEditingDesc = isRealSection && editingSectionDescId === entity.id;

              return (
                <SectionDroppable key={entity.id ?? '__other__'} section={section}>
                  {/* Section card — heading IS the card header so the section
                      visually OWNS its categories (not just a label above them). */}
                  <div className="overflow-hidden rounded-xl border border-[#D8CBB0] bg-card shadow-sm">
                    {/* Section header — warm well tint, strong rule only when expanded */}
                    <div
                      className={cn(
                        'flex items-start gap-2 bg-[#E8D5AF] px-3 py-3',
                        !collapsed && 'border-b border-[#C8B68C]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSection(section)}
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? `Expand ${section}` : `Collapse ${section}`}
                        className="mt-0.5 text-foreground/70 hover:text-foreground"
                      >
                        {collapsed ? (
                          <ChevronRight className="size-5" />
                        ) : (
                          <ChevronDown className="size-5" />
                        )}
                      </button>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {isRenaming ? (
                            <Input
                              className="h-7 w-auto min-w-[180px] font-mono text-sm font-bold uppercase tracking-[0.04em]"
                              value={editSectionValue}
                              onChange={(e) => setEditSectionValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Escape') {
                                  if (e.key === 'Enter') {
                                    const t = editSectionValue.trim();
                                    if (t && t !== section && entity.id) {
                                      startTransition(async () => {
                                        const r = await updateBudgetSectionAction({
                                          id: entity.id as string,
                                          project_id: projectId,
                                          name: t,
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
                              className="text-left font-mono text-sm font-bold uppercase tracking-[0.04em] text-foreground"
                            >
                              {section}
                            </button>
                          )}
                          {!isRenaming && isRealSection ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditSectionValue(section);
                                setEditingSectionName(section);
                              }}
                              aria-label={`Rename ${section}`}
                              className="rounded p-0.5 text-muted-foreground/60 hover:bg-[#EFE4CB] hover:text-foreground"
                            >
                              <Pencil className="size-3" />
                            </button>
                          ) : null}
                          {/* Delete offered only on empty real sections */}
                          {!isRenaming && isRealSection && sectionLines.length === 0 ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`Delete ${section}`}
                                  title="Delete section"
                                  className="rounded p-0.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{section}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This removes the empty section heading. It has no categories, so
                                    no scope or spend is affected.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeSection(entity.id as string)}
                                    disabled={isPending}
                                    className="bg-destructive/10 text-destructive hover:bg-destructive/20"
                                  >
                                    Delete section
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : null}
                          {/* Quiet variance chips — show when collapsed */}
                          {collapsed && overCats.length > 0 ? (
                            <StatusBadge
                              tone="danger"
                              className="font-medium normal-case tracking-normal"
                            >
                              <span className="tabular-nums">
                                <Money
                                  cents={overCats.reduce(
                                    (s, l) => s + (l.actual_cents - l.estimate_cents),
                                    0,
                                  )}
                                />
                              </span>{' '}
                              over
                              {overCats.length > 1 ? (
                                <span className="ml-1 opacity-70">({overCats.length})</span>
                              ) : null}
                            </StatusBadge>
                          ) : null}
                          {collapsed && projOverCats.length > 0 ? (
                            <StatusBadge
                              tone="warning"
                              className="font-medium normal-case tracking-normal"
                            >
                              <span className="tabular-nums">{projOverCats.length}</span> projected
                              over
                            </StatusBadge>
                          ) : null}
                        </div>
                        {/* Section description — only real sections */}
                        {isRealSection ? (
                          isEditingDesc ? (
                            <div className="space-y-1">
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    const sid = entity.id as string;
                                    setDraftingSectionId(sid);
                                    startTransition(async () => {
                                      const r = await draftBudgetSectionDescriptionAction({
                                        section_id: sid,
                                      });
                                      setDraftingSectionId(null);
                                      if (r.ok) {
                                        setEditSectionDescValue(r.text);
                                        toast.success('Drafted — review and save.');
                                      } else {
                                        toast.error(r.error);
                                      }
                                    });
                                  }}
                                  disabled={draftingSectionId === entity.id}
                                  className="inline-flex items-center gap-1 text-eyebrow text-brand hover:text-brand/80 disabled:opacity-60"
                                >
                                  {draftingSectionId === entity.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="size-3" />
                                  )}
                                  Draft from line items
                                </button>
                              </div>
                              <Textarea
                                className="min-h-[3.5rem] resize-y text-xs"
                                rows={2}
                                value={editSectionDescValue}
                                onChange={(e) => setEditSectionDescValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    const id = entity.id as string;
                                    startTransition(async () => {
                                      const r = await updateBudgetSectionAction({
                                        id,
                                        project_id: projectId,
                                        description_md: editSectionDescValue.trim(),
                                      });
                                      if (r.ok) {
                                        toast.success('Section description updated');
                                        setEditingSectionDescId(null);
                                      } else toast.error(r.error);
                                    });
                                  }
                                  if (e.key === 'Escape') setEditingSectionDescId(null);
                                }}
                                onBlur={() => {
                                  const id = entity.id as string;
                                  startTransition(async () => {
                                    const r = await updateBudgetSectionAction({
                                      id,
                                      project_id: projectId,
                                      description_md: editSectionDescValue.trim(),
                                    });
                                    if (r.ok) setEditingSectionDescId(null);
                                    else toast.error(r.error);
                                  });
                                }}
                                placeholder="Section description. Enter to save, Shift+Enter for new line."
                                autoFocus
                              />
                            </div>
                          ) : entity.description_md ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditSectionDescValue(entity.description_md ?? '');
                                setEditingSectionDescId(entity.id);
                              }}
                              title={entity.description_md}
                              className="line-clamp-1 text-left text-xs text-muted-foreground/80 hover:text-foreground"
                            >
                              {entity.description_md}
                            </button>
                          ) : null
                        ) : null}
                      </div>
                      {/* Section subtotal — right of header, not column-aligned */}
                      <div className="flex shrink-0 items-baseline gap-2 text-right">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          <Money cents={estimate} />
                        </span>
                        <span
                          className={cn(
                            'font-mono text-eyebrow tabular-nums',
                            seg.actuallyOver
                              ? 'text-destructive'
                              : seg.projectedOver
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-muted-foreground',
                          )}
                        >
                          {seg.usedPct}% used
                        </span>
                      </div>
                    </div>

                    {/* Section body — column labels + category rows */}
                    {!collapsed ? (
                      <>
                        <div
                          className={cn(
                            GRID,
                            'border-b border-[#E2D7C0] px-3 py-1 font-mono text-eyebrow uppercase tracking-wide text-muted-foreground/60',
                          )}
                        >
                          <span />
                          <span>Category</span>
                          <span className="text-right">Estimate</span>
                          <span className="text-right">Spent</span>
                          <span className="text-right">Committed</span>
                          <span className="text-right">Remaining</span>
                        </div>
                        <SortableContext
                          items={sectionLines.map((l) => l.budget_category_id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {sectionLines.map((line) => (
                            <BudgetCategoryRow
                              key={line.budget_category_id}
                              line={line}
                              isExpanded={expanded.has(line.budget_category_id)}
                              categoryLines={
                                linesByBudgetCategory.get(line.budget_category_id) ?? []
                              }
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
                              showHighlight={
                                highlight && line.budget_category_id === focusCategoryId
                              }
                              isFocused={line.budget_category_id === focusCategoryId}
                            />
                          ))}
                        </SortableContext>
                        {/* Contextual "+ Add category to {section}" */}
                        {addCategoryForSection === section ? (
                          <div className="border-t border-[#E2D7C0] bg-[#F9F4EE] py-1 pl-[50px] pr-3">
                            <AddBudgetCategoryForm
                              projectId={projectId}
                              kind="category"
                              existingSections={allSections.filter(Boolean)}
                              lockedSection={section}
                              nested
                              onDone={() => setAddCategoryForSection(null)}
                            />
                          </div>
                        ) : (
                          <div className="border-t border-[#E2D7C0] bg-[#F9F4EE] py-2 pl-[50px] pr-3">
                            <button
                              type="button"
                              onClick={() => {
                                setAddCategoryForSection(section);
                                setAddCategoryMode('closed');
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#D8CBB0] px-2.5 py-1.5 font-semibold text-xs text-muted-foreground transition-colors hover:border-foreground/60 hover:bg-[#FFFCF7] hover:text-foreground"
                            >
                              <Plus className="size-3" />
                              Add category to {section}
                            </button>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </SectionDroppable>
              );
            })}

            {/* Catch-all bottom add-row — "+ Add category" (with section picker)
                and "+ Add section". */}
            <div className="flex items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-3 py-2.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddCategoryForSection(null);
                  setAddCategoryMode((m) => (m === 'category' ? 'closed' : 'category'));
                }}
              >
                <Plus className="size-3.5" />
                {addCategoryMode === 'category' ? 'Cancel' : 'Add category'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddCategoryForSection(null);
                  setAddCategoryMode((m) => (m === 'section' ? 'closed' : 'section'));
                }}
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
  // Contained well: an open category + its lines read as ONE soft warm-neutral
  // group with a tonal left accent rule (NOT rust) — "you're working in here".
  const wellOpen = isExpanded && !isDragging;

  return (
    <div
      className={cn(
        wellOpen &&
          'relative border-t border-b border-[#D8CBB0] bg-[#F7EFDB] shadow-[inset_3px_0_0_0_#B89968]',
      )}
    >
      <div
        ref={rowRef}
        style={style}
        {...attributes}
        className={cn(
          GRID,
          'group border-b px-3 py-2 transition-colors',
          wellOpen ? 'border-b-0 bg-[#F2E9D4]' : 'hover:bg-[#FFFCF7]',
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
              className="cursor-grab touch-none text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100"
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
                  className="text-left text-base font-semibold hover:text-foreground"
                >
                  {line.budget_category_name}
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
              >
                <StatusBadge tone="info" label={`CO ${c.co_short_id}`} />
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
              className="line-clamp-1 text-left text-xs text-muted-foreground/80 hover:text-foreground"
            >
              {line.budget_category_description}
            </button>
          ) : null}
        </div>
        {/* estimate (editable when no priced lines) */}
        <span className="text-right text-sm font-medium">
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
            'text-right text-sm font-medium',
            line.actual_cents > line.estimate_cents && 'text-destructive',
          )}
        >
          {line.actual_cents > 0 ? <Money cents={line.actual_cents} /> : '—'}
        </span>
        {/* committed */}
        <span className="text-right text-sm font-medium text-muted-foreground">
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
                'text-right text-sm font-semibold tabular-nums',
                line.actual_cents > line.estimate_cents
                  ? 'text-destructive'
                  : line.actual_cents + line.committed_cents > line.estimate_cents
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-foreground',
              )}
            >
              <Money cents={Math.abs(line.remaining_cents)} />
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

      {/* Cost lines — same grid, value-by-column. Inside the contained well:
          a left guide rail runs down under the category name with subtle
          elbow connectors into each line. */}
      {wellOpen ? (
        <div className="relative bg-[#F7EFDB] pb-3 before:pointer-events-none before:absolute before:bottom-[22px] before:left-[50px] before:top-0 before:w-px before:bg-[#C8B68C]/70 before:content-['']">
          {categoryLines.map((cl, lineIdx) => {
            const a = actualsByLineId[cl.id];
            const spent = a ? a.labour_cents + a.bills_cents + a.expenses_cents : 0;
            const committed = a?.po_cents ?? 0;
            const remaining = cl.line_price_cents - spent - committed;
            const lineExpanded = expandedLineIds.has(cl.id);
            // Empty-cell placeholder: tiny + dim per OD ("is-empty" treatment).
            const dashCell = 'inline-block font-light tabular-nums text-muted-foreground/50';
            return (
              <div key={cl.id}>
                {/* LINE row — the anchor tier. Bright near-paper surface (clearly
                    lighter than the warm-cream category band above), discrete
                    band with a crisp hairline above (except the first), semibold
                    ink line name — the eye lands on the name first. */}
                <div
                  className={cn(
                    GRID,
                    'bg-[#FCF8EE] px-3 py-2 hover:bg-[#FFFCF7]',
                    lineIdx > 0 && 'border-t border-[#E5D6B4]',
                  )}
                >
                  <span />
                  {/* Deeper indent + elbow connector off the left guide rail —
                      LINE clearly sits under the CATEGORY. */}
                  <div className="relative flex min-w-0 flex-col pl-4 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-px before:w-2.5 before:bg-[#C8B68C]/70 before:content-['']">
                    <button
                      type="button"
                      onClick={() => toggleLineSpend(cl.id)}
                      className="flex items-start gap-1 text-left text-sm font-semibold text-foreground hover:text-foreground"
                      aria-expanded={lineExpanded}
                    >
                      {lineExpanded ? (
                        <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span>
                        {cl.label}
                        <span className="ml-1.5 font-mono text-eyebrow font-medium tracking-[0.02em] text-muted-foreground/70">
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
                    className="text-right text-sm font-semibold text-foreground hover:underline"
                    title="Edit this line"
                  >
                    <Money cents={cl.line_price_cents} />
                  </button>
                  <span className="text-right text-sm font-medium text-muted-foreground">
                    {spent > 0 ? <Money cents={spent} /> : <span className={dashCell}>—</span>}
                  </span>
                  <span className="text-right text-sm font-medium text-muted-foreground">
                    {committed > 0 ? (
                      <Money cents={committed} />
                    ) : (
                      <span className={dashCell}>—</span>
                    )}
                  </span>
                  <span className="flex items-center justify-end gap-1.5 text-right text-sm font-medium text-muted-foreground">
                    {remaining !== 0 ? (
                      <span className={cn(remaining < 0 && 'text-destructive')}>
                        <Money cents={Math.abs(remaining)} />
                      </span>
                    ) : (
                      <span className={dashCell}>—</span>
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
                  /* PER-LINE SPEND-DETAIL WELL — clearly SUBORDINATE to its line.
                     Faint cream tint (darker than the bright line-row above so
                     it never out-shines its parent), indented under the line, and
                     a 3px left accent rail tying it back to the line. */
                  <div className="relative mx-3 my-1 ml-[80px] mr-3 overflow-hidden rounded-r-lg border border-[#E5D6B4] border-l-[3px] border-l-[#B89968] bg-[#F1E7CD] py-2">
                    <CostLineActualsInline
                      projectId={projectId}
                      costLineId={cl.id}
                      costLineLabel={cl.label}
                      actuals={actualsByLineId[cl.id]}
                    />
                  </div>
                ) : null}
                {editingLine?.id === cl.id ? (
                  <div className="bg-muted/40 py-3 pl-[50px] pr-3">
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

          {/* cl-actions: add-line affordance + spent-by-source. Indented to the
              line-name start. The add-line row is a distinct full-width dashed
              "+ Add line" button on its own row so it reads as "add ANOTHER
              line" rather than part of the last line above it (founding-member
              feedback, card #5). */}
          <div className="flex flex-col gap-2 pl-[50px] pr-3 pt-2">
            {addingLineFor === line.budget_category_id ? (
              <div className="w-full pb-1">
                <CostLineForm
                  projectId={projectId}
                  catalog={catalog}
                  defaultCategoryId={line.budget_category_id}
                  seedPriceCents={categoryLines.length === 0 ? line.estimate_cents : undefined}
                  onDone={() => setAddingLineFor(null)}
                />
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full items-center justify-start gap-1.5 rounded-md border border-dashed border-[#C8B68C]/80 bg-card/40 px-3 py-2 font-medium text-sm text-muted-foreground transition-colors hover:border-foreground/50 hover:bg-card hover:text-foreground"
                onClick={() => {
                  setAddingLineFor(line.budget_category_id);
                  setEditingLine(null);
                }}
              >
                <Plus className="size-3.5 shrink-0" />
                Add line
              </button>
            )}
            {line.labor_cents > 0 || line.bills_cents > 0 || line.expense_cents > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-1 text-xs">
                <Eyebrow>Spent by source</Eyebrow>
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
                    Bills <Money cents={line.bills_cents} className="font-medium text-foreground" />
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
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Inline add form — Paper card. Two kinds, never ambiguous (header bar +
 * kind badge):
 *
 *   - `section`: a true minimal form — Name + Description only. Sections are a
 *     real entity (project_budget_sections) now, so an empty section persists;
 *     categories get added inside it afterward.
 *   - `category`: Name + Section (pick existing / new) + Estimate +
 *     Description. With `lockedSection` (the contextual foot-of-section
 *     variant) the Section picker is hidden and pre-filled.
 */
function AddBudgetCategoryForm({
  projectId,
  kind,
  existingSections,
  lockedSection,
  nested = false,
  onDone,
}: {
  projectId: string;
  kind: 'section' | 'category';
  existingSections: string[];
  /** Contextual variant: parent section known → hide + pre-fill the picker. */
  lockedSection?: string;
  /** Render nested under a section (tighter, no outer margin). */
  nested?: boolean;
  onDone: () => void;
}) {
  const isSection = kind === 'section';
  const [name, setName] = useState('');
  const initialIsCustom = !lockedSection && (isSection || existingSections.length === 0);
  const [section, setSection] = useState(
    lockedSection ?? (initialIsCustom ? '' : (existingSections[0] ?? '')),
  );
  const [isCustomSection, setIsCustomSection] = useState(initialIsCustom);
  const [estimate, setEstimate] = useState('');
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(isSection ? 'Section name is required' : 'Name is required');
      return;
    }

    if (isSection) {
      // Sections are a real entity now — create an EMPTY one (Name +
      // Description). No first-category requirement; categories get added
      // inside it after.
      startTransition(async () => {
        const r = await createBudgetSectionAction({
          project_id: projectId,
          name: name.trim(),
          description_md: description.trim() || undefined,
        });
        if (r.ok) {
          toast.success('Section created');
          onDone();
        } else toast.error(r.error);
      });
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
    <form
      onSubmit={handleSubmit}
      className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', nested && 'shadow-none')}
    >
      {/* Header bar — kind badge + title, so the form is never ambiguous. */}
      <div className="flex flex-wrap items-center gap-2.5 border-b bg-muted/40 px-4 py-2.5">
        <StatusBadge tone="neutral" label={isSection ? 'New section' : 'New category'} />

        <span className="font-bold text-base text-foreground">
          {isSection ? 'Add a budget section' : 'Add a budget category'}
        </span>
        <Eyebrow className="ml-auto">
          {isSection ? (
            'Name + description'
          ) : lockedSection ? (
            <>
              In <strong className="font-bold text-foreground/80">{lockedSection}</strong>
            </>
          ) : (
            'Catch-all · pick its section'
          )}
        </Eyebrow>
      </div>

      {/* Fields */}
      <div className="px-4 pt-4 pb-1">
        <div
          className={cn(
            'grid grid-cols-1 gap-3.5',
            // Section mode: just a name. Category mode: name + section + estimate.
            !isSection && 'sm:grid-cols-[2fr_1.4fr_1.1fr]',
          )}
        >
          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor="add-cat-name"
              className="font-mono text-eyebrow font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {isSection ? 'Section name' : 'Name'} <span className="text-brand">*</span>
            </label>
            <Input
              id="add-cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isSection ? 'e.g. Mechanical & HVAC' : 'e.g. Cabinets & millwork'}
              required
              autoFocus
            />
          </div>

          {isSection ? null : (
            <>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor="add-cat-section"
                  className="font-mono text-eyebrow font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Section <span className="text-brand">*</span>
                </label>
                {lockedSection ? (
                  <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-foreground">
                    {lockedSection}
                  </div>
                ) : isCustomSection ? (
                  <div className="flex items-center gap-2">
                    <Input
                      id="add-cat-section"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="New section name"
                    />
                    {existingSections.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomSection(false);
                          setSection(existingSections[0] ?? '');
                        }}
                        className="shrink-0 text-eyebrow text-muted-foreground hover:text-foreground hover:underline"
                      >
                        ← Pick existing
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <select
                    id="add-cat-section"
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
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor="add-cat-estimate"
                  className="font-mono text-eyebrow font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Estimate{' '}
                  <span className="font-normal text-muted-foreground/70 lowercase">CAD</span>
                </label>
                <Input
                  id="add-cat-estimate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimate}
                  onChange={(e) => setEstimate(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-3.5 flex flex-col gap-1.5">
          <label
            htmlFor="add-cat-desc"
            className="font-mono text-eyebrow font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Description{' '}
            <span className="font-normal text-muted-foreground/70 normal-case tracking-normal">
              optional
            </span>
          </label>
          <Textarea
            id="add-cat-desc"
            rows={3}
            className="min-h-[4.5rem] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              isSection
                ? "What's in this section? e.g. furnace replacement, ductwork relocation, suite air handling."
                : 'e.g. Demo existing tile, prep subfloor, install LVP'
            }
          />
        </div>
      </div>

      {/* Footer — hint + quiet Cancel + primary Add */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-dashed bg-[#FCFAF4] px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {isSection
            ? 'A section groups related categories. Create it empty, then add categories inside it.'
            : 'A category is a budget line item under a section. GST applied at the project level.'}
        </span>
        <span className="flex-1" />
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          <Plus className="size-3.5" />
          {isPending ? 'Adding…' : isSection ? 'Add section' : 'Add category'}
        </Button>
      </div>
    </form>
  );
}
