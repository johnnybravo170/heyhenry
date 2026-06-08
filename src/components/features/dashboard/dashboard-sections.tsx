'use client';

/**
 * Drag-to-reorder wrapper for the owner dashboard's top-level sections.
 *
 * The sections themselves stay server-rendered (streamed via <Suspense> in
 * page.tsx) — they're passed in as a key→node map and this client component
 * only owns their *order*. Reorders persist per-user via
 * saveDashboardSectionOrderAction; the optimistic local order reverts on a
 * failed save. Mirrors the dnd-kit vertical-sortable pattern used by the
 * budget table and phase rail.
 */

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { DashboardSectionKey } from '@/lib/dashboard/sections';
import { cn } from '@/lib/utils';
import { saveDashboardSectionOrderAction } from '@/server/actions/dashboard-preferences';

type DashboardSectionsProps = {
  initialOrder: DashboardSectionKey[];
  sections: Record<DashboardSectionKey, React.ReactNode>;
};

export function DashboardSections({ initialOrder, sections }: DashboardSectionsProps) {
  const [order, setOrder] = useState<DashboardSectionKey[]>(initialOrder);
  const [, startTransition] = useTransition();

  // Keep in sync if a server revalidation hands down a new saved order
  // (e.g. the user reordered in another tab).
  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = order.indexOf(active.id as DashboardSectionKey);
    const to = order.indexOf(over.id as DashboardSectionKey);
    if (from === -1 || to === -1) return;

    const previous = order;
    const next = arrayMove(order, from, to);
    setOrder(next);
    startTransition(async () => {
      const res = await saveDashboardSectionOrderAction({ order: next });
      if (!res.ok) {
        setOrder(previous);
        toast.error(res.error || "Couldn't save layout.");
      }
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-6">
          {order.map((key) => (
            <SortableSection key={key} id={key}>
              {sections[key]}
            </SortableSection>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group relative', isDragging && 'z-20 opacity-90')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder section"
        className="absolute right-2 top-2 z-10 cursor-grab touch-none rounded-md border bg-background/80 p-1 text-muted-foreground/50 opacity-0 shadow-sm backdrop-blur transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      {children}
    </div>
  );
}
