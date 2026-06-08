'use client';

/**
 * Interactive operator Schedule surface — wraps `<ScheduleGantt>` and the
 * This-week digest with the edit UX: click-to-edit, drag-to-reschedule,
 * drag-to-resize, "+ Add task", per-bar quick actions (Mark done / Lock
 * dates), a demoted ⋯ overflow (Clear & start over · Auto-link), a
 * customer-notify Undo strip, and a Preview-as-customer drawer.
 *
 * The digest is the "now" lens and the **default view on mobile** (the
 * Gantt sits behind a List / Timeline toggle). The behind set is computed
 * client-side from the loaded tasks via the SAME working-day predicate the
 * shared `getScheduleSlip` source uses, so the digest count, the Gantt
 * outline, the Overview strip, and the tab badge all agree.
 *
 * State lives here so the page-level tab-server stays a pure server
 * component; this is the single client boundary for the edit UX.
 */

import { ListChecks, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { PortalScheduleGantt } from '@/components/features/portal/portal-schedule-gantt';
import {
  type CascadeExplainerState,
  ScheduleCascadeExplainer,
} from '@/components/features/projects/schedule-cascade-explainer';
import { ScheduleClearButton } from '@/components/features/projects/schedule-clear-button';
import {
  type AcceptedCoItem,
  ScheduleCoSuggestion,
} from '@/components/features/projects/schedule-co-suggestion';
import { ScheduleGantt } from '@/components/features/projects/schedule-gantt';
import { ScheduleRegenerateDepsButton } from '@/components/features/projects/schedule-regenerate-deps-button';
import {
  bumpedStartIso,
  ScheduleSlipPrompt,
} from '@/components/features/projects/schedule-slip-prompt';
import { ScheduleTaskEditor } from '@/components/features/projects/schedule-task-editor';
import {
  computeWeekDigest,
  ScheduleWeekDigest,
} from '@/components/features/projects/schedule-week-digest';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import { addWorkingDays, workingDayEnd, workingDaysBetween } from '@/lib/date/working-days';
import type { CoScheduleSuggestion, ProjectScheduleTask } from '@/lib/db/queries/project-schedule';
import { statusToneClass } from '@/lib/ui/status-tokens';
import {
  acceptCoScheduleSuggestionAction,
  cancelScheduleNotifyAction,
  dismissCoScheduleSuggestionAction,
  notifyCustomerOfScheduleChangeAction,
  updateScheduleTaskAction,
} from '@/server/actions/project-schedule';

export type SchedulePhase = { id: string; name: string; display_order: number };

type MobileView = 'list' | 'timeline';

export function ScheduleInteractive({
  projectId,
  tasks,
  phases,
  tradeTypicalPhase,
  pendingNotifyAt,
  predecessorsByTaskId,
  coSuggestions,
}: {
  projectId: string;
  tasks: ProjectScheduleTask[];
  phases: SchedulePhase[];
  /** trade_template_id → trade.typical_phase (for color fallback when
   *  the project uses custom phase names that don't match canonical
   *  color-map keys). Plain object so it serializes as RSC props. */
  tradeTypicalPhase: Record<string, string>;
  /** ISO timestamp of the pending customer schedule-update notify, or
   *  null when no notify is queued (default tenant flag off, OR notify
   *  already sent/cancelled). Drives the Undo banner. */
  pendingNotifyAt: string | null;
  /** successor task id → list of predecessor task ids. Threaded into
   *  the editor's "Depends on" picker. */
  predecessorsByTaskId: Record<string, string[]>;
  /** Approved, not-yet-dismissed change orders awaiting scheduling —
   *  the CO→schedule Henry prompt (brief touchpoint #3). */
  coSuggestions: CoScheduleSuggestion[];
}) {
  const router = useRouter();
  const timezone = useTenantTimezone();
  const [, startTransition] = useTransition();
  const [editingTask, setEditingTask] = useState<ProjectScheduleTask | null>(null);
  const [creating, setCreating] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [autoLinkOpen, setAutoLinkOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // The active Henry cascade explainer (transient, dismissible). Set when
  // a date/duration edit ripples ≥1 downstream task; cleared on Undo,
  // Dismiss, or the next edit. `notifyQueued` tracks whether the operator
  // already tapped "Notify customer" for this cascade.
  const [cascadeState, setCascadeState] = useState<CascadeExplainerState | null>(null);
  const [cascadeNotifyQueued, setCascadeNotifyQueued] = useState(false);
  // Mobile List/Timeline toggle — List (the digest) is the default. Desktop
  // shows both stacked regardless (the toggle is mobile-only via CSS).
  const [mobileView, setMobileView] = useState<MobileView>('list');
  // Optimistic patches keyed by taskId, applied to the visible Gantt
  // until the server-action round-trip + router.refresh() lands fresh
  // data. Clearing per-task when a refreshed task matches the patch.
  const [pendingPatches, setPendingPatches] = useState<
    Map<string, { planned_start_date?: string; planned_duration_days?: number }>
  >(new Map());

  // Apply pending patches on top of the server-rendered tasks so the
  // bar stays at its dragged position while the action persists.
  const visibleTasks = tasks.map((t) => {
    const p = pendingPatches.get(t.id);
    if (!p) return t;
    const matches =
      (p.planned_start_date === undefined || p.planned_start_date === t.planned_start_date) &&
      (p.planned_duration_days === undefined ||
        p.planned_duration_days === t.planned_duration_days);
    if (matches) return t;
    return { ...t, ...p };
  });

  // Drop pending entries that the server has caught up to. Done as a
  // post-render side effect so we don't mutate during render.
  if (pendingPatches.size > 0) {
    let hasResolved = false;
    for (const [taskId, p] of pendingPatches.entries()) {
      const t = tasks.find((x) => x.id === taskId);
      if (!t) {
        hasResolved = true;
        break;
      }
      if (
        (p.planned_start_date === undefined || p.planned_start_date === t.planned_start_date) &&
        (p.planned_duration_days === undefined ||
          p.planned_duration_days === t.planned_duration_days)
      ) {
        hasResolved = true;
        break;
      }
    }
    if (hasResolved) {
      Promise.resolve().then(() => {
        setPendingPatches((prev) => {
          const next = new Map(prev);
          for (const [taskId, p] of next.entries()) {
            const t = tasks.find((x) => x.id === taskId);
            if (
              !t ||
              ((p.planned_start_date === undefined ||
                p.planned_start_date === t.planned_start_date) &&
                (p.planned_duration_days === undefined ||
                  p.planned_duration_days === t.planned_duration_days))
            ) {
              next.delete(taskId);
            }
          }
          return next;
        });
      });
    }
  }

  // This-week digest + behind set, recomputed from the loaded tasks (incl.
  // optimistic drags) with the shared working-day predicate.
  const digest = computeWeekDigest(visibleTasks, timezone);
  const behindTaskIds = digest.behindIds;
  const behindIdSet = new Set(behindTaskIds);
  const behindTasks = visibleTasks.filter((t) => behindIdSet.has(t.id));

  const handleTaskUpdate = (
    taskId: string,
    patch: { planned_start_date?: string; planned_duration_days?: number },
  ) => {
    // Snapshot the origin task's pre-edit state so the cascade explainer
    // can label the move ("+3 working days") and Undo can restore it.
    const before = tasks.find((t) => t.id === taskId);
    setPendingPatches((prev) => {
      const next = new Map(prev);
      next.set(taskId, { ...(prev.get(taskId) ?? {}), ...patch });
      return next;
    });
    startTransition(async () => {
      const res = await updateScheduleTaskAction(taskId, patch);
      if (!res.ok) {
        // Roll back the optimistic patch on failure + surface via toast.
        setPendingPatches((prev) => {
          const next = new Map(prev);
          next.delete(taskId);
          return next;
        });
        toast.error(`Could not save: ${res.error}`);
        return;
      }
      // Surface the Henry cascade explainer when ≥1 downstream task moved.
      if (before && res.cascade && res.cascade.count > 0) {
        // Signed working-day delta the operator applied to the origin: a
        // start move is measured in working days; a pure resize uses the
        // duration delta. (Both can move in one edit — start dominates the
        // headline since that's what the operator dragged.)
        let delta = 0;
        if (patch.planned_start_date !== undefined) {
          delta = workingDaysBetween(
            new Date(`${before.planned_start_date}T00:00:00Z`),
            new Date(`${patch.planned_start_date}T00:00:00Z`),
          );
        } else if (patch.planned_duration_days !== undefined) {
          delta = patch.planned_duration_days - before.planned_duration_days;
        }
        setCascadeState({
          originId: before.id,
          originName: before.name,
          originUndo: {
            planned_start_date: before.planned_start_date,
            planned_duration_days: before.planned_duration_days,
          },
          workingDayDelta: delta,
          cascade: res.cascade,
        });
        setCascadeNotifyQueued(false);
      }
      router.refresh();
    });
  };

  // Slip-prompt "Bump 1 day": push the task's planned_start by one working
  // day via the same update action (which cascades downstream as usual).
  const handleBump = (taskId: string) => {
    const task = visibleTasks.find((t) => t.id === taskId);
    if (!task) return;
    handleTaskUpdate(taskId, { planned_start_date: bumpedStartIso(task) });
  };

  // Re-apply the origin task's pre-cascade start + duration to unwind the
  // ripple (the forward cascade re-runs on the restored state — a no-op
  // since nothing's now violated), then clear the explainer.
  const handleCascadeUndo = () => {
    if (!cascadeState) return;
    const { originId, originUndo } = cascadeState;
    setCascadeState(null);
    startTransition(async () => {
      const res = await updateScheduleTaskAction(originId, originUndo);
      if (!res.ok) {
        toast.error(`Could not undo: ${res.error}`);
        return;
      }
      toast.success('Undone.');
      router.refresh();
    });
  };

  // "Notify customer" from the explainer — routes into the EXISTING
  // deferred-notify path (cron + 5-min Undo). Caller already gated this
  // to firm + client-visible moved tasks.
  const handleCascadeNotify = () => {
    if (!cascadeState) return;
    startTransition(async () => {
      const res = await notifyCustomerOfScheduleChangeAction(projectId);
      if (!res.ok) {
        toast.error(`Could not queue notice: ${res.error}`);
        return;
      }
      setCascadeNotifyQueued(true);
      toast.success('Customer notice queued — Undo within 5 minutes.');
      router.refresh();
    });
  };

  // Quick actions — the two highest-frequency edits without a modal.
  const handleMarkDone = (taskId: string) => {
    startTransition(async () => {
      const res = await updateScheduleTaskAction(taskId, { status: 'done' });
      if (!res.ok) {
        toast.error(`Could not mark done: ${res.error}`);
        return;
      }
      toast.success('Marked done.');
      router.refresh();
    });
  };

  const handleLockDates = (taskId: string) => {
    startTransition(async () => {
      const res = await updateScheduleTaskAction(taskId, { confidence: 'firm' });
      if (!res.ok) {
        toast.error(`Could not lock dates: ${res.error}`);
        return;
      }
      toast.success('Dates locked — the customer will see these.');
      router.refresh();
    });
  };

  // Default new tasks to the day after the last task ends, so the
  // operator's add-flow doesn't have to type a date for the common
  // "next thing in the sequence" case.
  const defaultStartDate = (() => {
    if (visibleTasks.length === 0) return new Date().toISOString().slice(0, 10);
    const ends = visibleTasks.map((t) => {
      const start = new Date(`${t.planned_start_date}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() + t.planned_duration_days);
      return start.getTime();
    });
    const lastEnd = new Date(Math.max(...ends));
    return lastEnd.toISOString().slice(0, 10);
  })();

  // Whether any task has a "Depends on" edge — drives the inline,
  // non-destructive auto-link affordance in the empty-deps case.
  const hasAnyDependency = Object.values(predecessorsByTaskId).some((p) => p.length > 0);

  // CO → schedule prompt: existing tasks for the "Add after" picker.
  const coTaskOptions = visibleTasks.map((t) => ({ id: t.id, name: t.name }));

  // Accept a CO→schedule draft. Compute the drafted task's start from the
  // chosen predecessor's working-day end (next working day), else fall to
  // the end-of-schedule default; the server wires the predecessor edge,
  // whose cascade keeps the start honest if it still violates.
  const handleCoAccept = (coId: string, predecessorId: string | null, items: AcceptedCoItem[]) => {
    let start = defaultStartDate;
    if (predecessorId) {
      const pred = visibleTasks.find((t) => t.id === predecessorId);
      if (pred) {
        const end = workingDayEnd(
          new Date(`${pred.planned_start_date}T00:00:00Z`),
          pred.planned_duration_days,
          {
            basis: pred.duration_basis === 'calendar' ? 'calendar' : 'working',
            worksWeekends: Boolean(pred.works_weekends),
          },
        );
        start = addWorkingDays(end, 1).toISOString().slice(0, 10);
      }
    }
    startTransition(async () => {
      const res = await acceptCoScheduleSuggestionAction({
        coId,
        projectId,
        predecessorId,
        items: items.map((it) => ({ name: it.name, planned_start_date: start })),
      });
      if (!res.ok) {
        toast.error(`Could not add to schedule: ${res.error}`);
        return;
      }
      toast.success(
        `${res.created} ${res.created === 1 ? 'task' : 'tasks'} added to the schedule.`,
      );
      router.refresh();
    });
  };

  const handleCoDismiss = (coId: string) => {
    startTransition(async () => {
      const res = await dismissCoScheduleSuggestionAction({ coId, projectId });
      if (!res.ok) {
        toast.error(`Could not dismiss: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };

  // Firm + client-visible tasks for the Preview-as-customer drawer (the
  // portal renders firm bars only). Mapped to the portal view shape.
  const previewTasks = visibleTasks
    .filter((t) => t.confidence === 'firm' && t.client_visible)
    .map((t) => ({
      ...t,
      warning: null,
      phaseName: t.phase_id ? (phases.find((p) => p.id === t.phase_id)?.name ?? null) : null,
    }));

  return (
    <div className="space-y-3">
      {/* This-week digest — the "now" lens. Always shown on desktop; the
          default (List) view on mobile. */}
      <div className={mobileView === 'timeline' ? 'hidden sm:block' : 'block'}>
        <ScheduleWeekDigest
          digest={digest}
          timezone={timezone}
          onJumpToBehind={() => setMobileView('timeline')}
        />
      </div>

      {/* Firm / rough / behind legend — the bar vocabulary teach. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-0.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" /> Firm
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-dashed border-primary bg-primary/10" />{' '}
          Rough
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-500" /> Done
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted ring-2 ring-destructive/70" /> Behind
        </span>
      </div>

      {/* Henry ✦ cascade explainer — the transient ripple summary after a
          drag/resize moves downstream tasks. Undoable; Notify customer
          only when the moved set is firm + client-visible. */}
      {cascadeState ? (
        <ScheduleCascadeExplainer
          state={cascadeState}
          timezone={timezone}
          notifyQueued={cascadeNotifyQueued}
          onUndo={handleCascadeUndo}
          onNotify={handleCascadeNotify}
          onDismiss={() => setCascadeState(null)}
        />
      ) : null}

      {/* Henry ✦ slip prompt — one-tap Bump / Mark done for behind tasks. */}
      <ScheduleSlipPrompt
        behindTasks={behindTasks}
        timezone={timezone}
        onBump={handleBump}
        onMarkDone={handleMarkDone}
      />

      {/* Henry ✦ CO → schedule prompt — draft tasks for an approved change
          order's added scope; closes the unlinked-CO gap (#13). */}
      <ScheduleCoSuggestion
        suggestions={coSuggestions}
        taskOptions={coTaskOptions}
        onAccept={handleCoAccept}
        onDismiss={handleCoDismiss}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}
          {/* Drag hints don't apply on touch — keep them desktop-only. */}
          <span className="hidden sm:inline">
            {' · '}click to edit · drag to reschedule · drag the right edge to resize
          </span>
          <span className="sm:hidden"> · tap any bar to edit</span>
        </p>
        <div className="flex items-center gap-2">
          {/* Mobile-only List/Timeline toggle. */}
          <div className="inline-flex rounded-md border p-0.5 sm:hidden">
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className={`rounded px-2 py-1 text-xs font-medium ${mobileView === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setMobileView('timeline')}
              className={`rounded px-2 py-1 text-xs font-medium ${mobileView === 'timeline' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
            >
              Timeline
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="hidden sm:inline-flex"
          >
            Preview as customer
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
            + Add task
          </Button>

          {/* ⋯ overflow — the demoted destructive globals. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Schedule actions"
                className="px-2"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setAutoLinkOpen(true)}>
                <ListChecks className="size-4" />
                Auto-link dependencies
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setClearOpen(true)}>
                Clear &amp; start over
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Empty-deps inline affordance — non-destructive, no confirm. */}
      {!hasAnyDependency && visibleTasks.length > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            No dependencies yet — link them automatically so a slipped task pulls the rest forward.
          </span>
          <ScheduleRegenerateDepsButton projectId={projectId} variant="inline" />
        </div>
      ) : null}

      {pendingNotifyAt ? (
        <div
          className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${statusToneClass.warning}`}
        >
          <span>
            <span className="font-medium">Customer email queued.</span> They&rsquo;ll be notified
            shortly about the schedule changes.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-background"
            onClick={() => {
              startTransition(async () => {
                const res = await cancelScheduleNotifyAction(projectId);
                if (!res.ok) {
                  toast.error(`Could not cancel: ${res.error}`);
                  return;
                }
                router.refresh();
              });
            }}
          >
            Undo
          </Button>
        </div>
      ) : null}

      {/* The Gantt is the Timeline view on mobile (behind the toggle) and
          always visible on desktop. */}
      <div className={mobileView === 'list' ? 'hidden sm:block' : 'block'}>
        <ScheduleGantt
          tasks={visibleTasks}
          phases={phases}
          tradeTypicalPhase={tradeTypicalPhase}
          behindTaskIds={behindTaskIds}
          onTaskClick={setEditingTask}
          onTaskUpdate={handleTaskUpdate}
          onMarkDone={handleMarkDone}
          onLockDates={handleLockDates}
        />
      </div>

      {editingTask ? (
        <ScheduleTaskEditor
          mode={{ kind: 'edit', task: editingTask }}
          allTasks={tasks}
          initialPredecessorIds={predecessorsByTaskId[editingTask.id] ?? []}
          open={true}
          onClose={() => setEditingTask(null)}
        />
      ) : null}

      {creating ? (
        <ScheduleTaskEditor
          mode={{ kind: 'create', projectId, defaultStartDate }}
          allTasks={tasks}
          initialPredecessorIds={[]}
          open={true}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {/* Destructive globals — hosted trigger-less here, opened from ⋯. */}
      <ScheduleClearButton
        projectId={projectId}
        open={clearOpen}
        onOpenChange={setClearOpen}
        hideTrigger
      />
      <ScheduleRegenerateDepsButton
        projectId={projectId}
        open={autoLinkOpen}
        onOpenChange={setAutoLinkOpen}
        hideTrigger
      />

      {/* Preview as customer — the firm-bar portal view, so the operator
          sees exactly what the client sees before locking / notifying. */}
      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <button
            type="button"
            aria-label="Close customer preview"
            className="absolute inset-0 cursor-default"
            onClick={() => setPreviewOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-preview-title"
            className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border bg-background p-5 shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 id="customer-preview-title" className="text-base font-semibold">
                  Customer preview
                </h3>
                <p className="text-xs text-muted-foreground">
                  Firm, client-visible tasks only — exactly what the homeowner sees on the portal.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {previewTasks.length === 0 ? (
                <p className="rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  Nothing to show yet — lock a task&rsquo;s dates (rough → firm) and keep it
                  client-visible for it to appear here.
                </p>
              ) : (
                <PortalScheduleGantt tasks={previewTasks} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
