'use client';

/**
 * Crew roster — the project-level half of the old Crew tab, now living in
 * the Project Details card.
 *
 * A multi-select checklist of the tenant's workers + subs. Each row shows
 * the worker's account default rate (muted, read-only). Tick → add to the
 * crew (writes a `project_assignments` row with `scheduled_date = null` and
 * null rate overrides = inherit the default). A per-row `⌄` reveals the
 * pay/charge override + note, only needed when this job pays or charges
 * someone differently. Scheduling (dated assignments) is a separate,
 * deferred surface — this is roster only.
 *
 * Owner/admin only; the underlying actions assert the role.
 */

import { ChevronDown, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/pricing/calculator';
import {
  assignWorkerAction,
  removeAssignmentAction,
  updateAssignmentRatesAction,
} from '@/server/actions/project-assignments';

export type RosterWorker = {
  profile_id: string;
  display_name: string;
  worker_type: 'employee' | 'subcontractor';
  default_hourly_rate_cents: number | null;
  default_charge_rate_cents: number | null;
};

export type RosterAssignment = {
  id: string;
  worker_profile_id: string;
  hourly_rate_cents: number | null;
  charge_rate_cents: number | null;
  notes: string | null;
};

export function CrewRoster({
  projectId,
  workers,
  assignments,
}: {
  projectId: string;
  workers: RosterWorker[];
  /** Roster (ongoing, `scheduled_date IS NULL`) assignments for this project. */
  assignments: RosterAssignment[];
}) {
  const router = useRouter();
  const byWorker = new Map(assignments.map((a) => [a.worker_profile_id, a]));

  if (workers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No workers yet. Invite one from{' '}
        <a href="/settings/team" className="underline">
          Settings › Team
        </a>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {workers.map((w) => (
        <RosterRow
          key={w.profile_id}
          projectId={projectId}
          worker={w}
          assignment={byWorker.get(w.profile_id) ?? null}
          onChanged={() => router.refresh()}
        />
      ))}
    </ul>
  );
}

function rateLabel(cents: number | null): string {
  return cents !== null ? `${formatCurrency(cents)}/hr` : '—';
}

function dollarsFromCents(cents: number | null): string {
  return cents !== null ? (cents / 100).toString() : '';
}

function RosterRow({
  projectId,
  worker,
  assignment,
  onChanged,
}: {
  projectId: string;
  worker: RosterWorker;
  assignment: RosterAssignment | null;
  onChanged: () => void;
}) {
  const onRoster = assignment !== null;
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    startTransition(async () => {
      if (next) {
        const res = await assignWorkerAction({
          project_id: projectId,
          worker_profile_id: worker.profile_id,
          scheduled_date: null,
        });
        if (!res.ok) {
          toast.error(res.error ?? 'Failed to add to crew.');
          return;
        }
        toast.success(`${worker.display_name} added to crew.`);
      } else {
        if (!assignment) return;
        const res = await removeAssignmentAction(assignment.id);
        if (!res.ok) {
          toast.error(res.error ?? 'Failed to remove.');
          return;
        }
        toast.success(`${worker.display_name} removed from crew.`);
        setExpanded(false);
      }
      onChanged();
    });
  }

  const hasOverride =
    assignment !== null &&
    (assignment.hourly_rate_cents !== null ||
      assignment.charge_rate_cents !== null ||
      !!assignment.notes);

  return (
    <li className="rounded-md border">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Checkbox
          id={`roster-${worker.profile_id}`}
          checked={onRoster}
          disabled={pending}
          onCheckedChange={(v) => toggle(v === true)}
        />
        <label
          htmlFor={`roster-${worker.profile_id}`}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
        >
          <span className="truncate text-sm font-medium">{worker.display_name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {worker.worker_type === 'subcontractor' ? 'sub' : 'employee'}
          </span>
        </label>
        <span className="shrink-0 text-xs text-muted-foreground">
          {hasOverride && assignment
            ? `${rateLabel(assignment.hourly_rate_cents ?? worker.default_hourly_rate_cents)} pay`
            : `${rateLabel(worker.default_hourly_rate_cents)} pay`}
          {hasOverride ? <span className="ml-1">(override)</span> : null}
        </span>
        {pending ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
        {onRoster ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label="Rate override"
            aria-expanded={expanded}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronDown
              className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        ) : null}
      </div>

      {onRoster && expanded && assignment ? (
        <OverrideForm
          worker={worker}
          assignment={assignment}
          onSaved={() => {
            setExpanded(false);
            onChanged();
          }}
        />
      ) : null}
    </li>
  );
}

function OverrideForm({
  worker,
  assignment,
  onSaved,
}: {
  worker: RosterWorker;
  assignment: RosterAssignment;
  onSaved: () => void;
}) {
  const [pay, setPay] = useState(dollarsFromCents(assignment.hourly_rate_cents));
  const [charge, setCharge] = useState(dollarsFromCents(assignment.charge_rate_cents));
  const [notes, setNotes] = useState(assignment.notes ?? '');
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateAssignmentRatesAction({
        assignment_id: assignment.id,
        pay_rate_dollars: pay,
        charge_rate_dollars: charge,
        notes,
      });
      if (!res.ok) {
        toast.error(res.error ?? 'Failed to save override.');
        return;
      }
      toast.success('Override saved.');
      onSaved();
    });
  }

  return (
    <div className="space-y-2 border-t bg-muted/20 px-2 py-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">
            Pay override <span className="text-muted-foreground">($/hr)</span>
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={pay}
            onChange={(e) => setPay(e.target.value)}
            placeholder={dollarsFromCents(worker.default_hourly_rate_cents) || 'default'}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            Charge override <span className="text-muted-foreground">($/hr)</span>
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={charge}
            onChange={(e) => setCharge(e.target.value)}
            placeholder={dollarsFromCents(worker.default_charge_rate_cents) || 'default'}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Note</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Only this job…"
          className="h-8 text-sm"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Blank = inherit the worker&rsquo;s account default.
      </p>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
          Save override
        </Button>
      </div>
    </div>
  );
}
