'use client';

/**
 * Henry cascade explainer — the headline embedded-Henry moment on the
 * Schedule tab. When a drag/resize cascades ≥1 downstream task via
 * `cascadeForwardFromTask`, this inline ✦ strip turns the (previously
 * silent) ripple into a trust moment:
 *
 *   "✦ Moving Drywall +3 working days pushed Finishes, Punch List &
 *    Final Walkthrough. New finish: Apr 2 → Apr 8."
 *
 * with **Undo** (re-applies the originating task's pre-cascade state)
 * and — only when every moved task is firm + client-visible — a
 * **Notify customer** action that routes into the EXISTING deferred-
 * notify path (cron + 5-min Undo). Nothing auto-sends to the customer.
 *
 * Rust ✦ + left-border chrome (the codebase's Henry convention). A later
 * finish is caution-soft (status-tokens `warning`), never alarm-red — a
 * cascade is information, not an error.
 */

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/date/format';
import { statusToneClass } from '@/lib/ui/status-tokens';
import type { CascadeResult } from '@/server/actions/project-schedule';

export type CascadeExplainerState = {
  /** The originating task's id — Undo re-applies its pre-cascade state. */
  originId: string;
  /** The originating task's name, for the headline ("Moving Drywall…"). */
  originName: string;
  /** The originating task's pre-edit start/duration, for Undo. */
  originUndo: { planned_start_date: string; planned_duration_days: number };
  /** Signed working-day delta the operator applied to the origin task. */
  workingDayDelta: number;
  /** The cascade result threaded back from updateScheduleTaskAction. */
  cascade: CascadeResult;
};

/** Oxford-comma join of names: "A", "A & B", "A, B & C". */
function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export function ScheduleCascadeExplainer({
  state,
  timezone,
  notifyQueued,
  onUndo,
  onNotify,
  onDismiss,
}: {
  state: CascadeExplainerState;
  timezone: string;
  /** True once a notify has been queued for this cascade (hides Notify). */
  notifyQueued: boolean;
  onUndo: () => void;
  onNotify: () => void;
  onDismiss: () => void;
}) {
  const { originName, workingDayDelta, cascade } = state;
  const movedNames = cascade.moved.map((m) => m.name);
  // Notify only when EVERY moved task is firm + client-visible — never
  // ping the customer about a still-rough internal date.
  const allFirmVisible =
    cascade.moved.length > 0 &&
    cascade.moved.every((m) => m.confidence === 'firm' && m.clientVisible);

  const { finishBefore, finishAfter } = cascade;
  const finishMoved = Boolean(finishBefore && finishAfter && finishBefore !== finishAfter);

  const deltaLabel =
    workingDayDelta === 0
      ? ''
      : ` ${workingDayDelta > 0 ? '+' : '−'}${Math.abs(workingDayDelta)} working ${
          Math.abs(workingDayDelta) === 1 ? 'day' : 'days'
        }`;

  return (
    <div className={`rounded-r-lg border border-l-2 border-l-brand p-3 ${statusToneClass.warning}`}>
      <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-brand">
        <Sparkles className="size-3" aria-hidden />
        Henry
      </div>
      <p className="text-sm leading-snug text-foreground">
        Moving <span className="font-medium">{originName}</span>
        {deltaLabel} pushed <span className="font-medium">{joinNames(movedNames)}</span>.
        {finishMoved && finishBefore && finishAfter ? (
          <>
            {' '}
            New finish:{' '}
            <span className="font-medium">
              {formatDate(`${finishBefore}T00:00:00Z`, { timezone, style: 'medium' })}
            </span>{' '}
            →{' '}
            <span className="font-medium">
              {formatDate(`${finishAfter}T00:00:00Z`, { timezone, style: 'medium' })}
            </span>
            .
          </>
        ) : null}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-background"
          onClick={onUndo}
        >
          Undo
        </Button>
        {allFirmVisible && !notifyQueued ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-background"
            onClick={onNotify}
          >
            Notify customer
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto text-muted-foreground"
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
