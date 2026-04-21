'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ReasonTag } from '@/lib/db/queries/worker-unavailability';
import { addUnavailabilityAction } from '@/server/actions/worker-unavailability';

export type ScheduleCell =
  | { type: 'scheduled'; projectName: string }
  | { type: 'unavailable'; reasonLabel: string; reasonText: string | null }
  | { type: 'both'; projectName: string; reasonLabel: string }
  | { type: 'empty' };

type Worker = { profile_id: string; display_name: string };

type Props = {
  projectId: string;
  startDate: string; // yyyy-mm-dd (first day shown)
  days: number; // e.g. 14
  workers: Worker[];
  /** Map key = `${worker_profile_id}|${iso_date}` */
  cells: Record<string, ScheduleCell>;
};

type Run = { startIdx: number; endIdx: number; label: string };

function addDays(iso: string, offset: number): string {
  const d = new Date(`${iso}T00:00`);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
}

function scheduledKey(c: ScheduleCell): string | null {
  if (c.type === 'scheduled' || c.type === 'both') return c.projectName;
  return null;
}

function unavailableKey(c: ScheduleCell): string | null {
  if (c.type === 'unavailable' || c.type === 'both') return c.reasonLabel;
  return null;
}

function buildRuns(
  dates: string[],
  cellsForWorker: ScheduleCell[],
  getKey: (c: ScheduleCell) => string | null,
): Run[] {
  const runs: Run[] = [];
  let i = 0;
  while (i < dates.length) {
    const key = getKey(cellsForWorker[i]);
    if (!key) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < dates.length && getKey(cellsForWorker[j + 1]) === key) j++;
    runs.push({ startIdx: i, endIdx: j, label: key });
    i = j + 1;
  }
  return runs;
}

export function CrewScheduleGrid({
  projectId: _projectId,
  startDate,
  days,
  workers,
  cells,
}: Props) {
  const dates: string[] = Array.from({ length: days }, (_, i) => addDays(startDate, i));

  const [drag, setDrag] = useState<{
    workerId: string;
    startIdx: number;
    endIdx: number;
  } | null>(null);
  const [dialog, setDialog] = useState<{
    workerId: string;
    workerName: string;
    from: string;
    to: string;
  } | null>(null);

  // Commit drag on pointer release anywhere in the document.
  const dragRef = useRef(drag);
  dragRef.current = drag;
  useEffect(() => {
    function handleUp() {
      const d = dragRef.current;
      if (!d) return;
      const s = Math.min(d.startIdx, d.endIdx);
      const e = Math.max(d.startIdx, d.endIdx);
      const w = workers.find((x) => x.profile_id === d.workerId);
      if (w) {
        setDialog({
          workerId: w.profile_id,
          workerName: w.display_name,
          from: dates[s],
          to: dates[e],
        });
      }
      setDrag(null);
    }
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dates, workers]);

  if (workers.length === 0) {
    return <p className="text-sm text-muted-foreground">No workers assigned yet.</p>;
  }

  const gridTemplate = { gridTemplateColumns: `160px repeat(${days}, minmax(0, 1fr))` };

  return (
    <div className="select-none overflow-x-auto rounded-lg border">
      <div style={gridTemplate} className="grid border-b bg-muted/40 text-xs font-medium">
        <div className="px-3 py-2">Worker</div>
        {dates.map((d) => {
          const dt = new Date(`${d}T00:00`);
          const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
          return (
            <div
              key={d}
              className={`border-l px-1 py-2 text-center ${isWeekend ? 'text-muted-foreground/70' : ''}`}
            >
              <div>{dt.toLocaleDateString('en-CA', { weekday: 'short' }).slice(0, 2)}</div>
              <div>{dt.getDate()}</div>
            </div>
          );
        })}
      </div>

      {workers.map((w) => {
        const perDay: ScheduleCell[] = dates.map(
          (d) => cells[`${w.profile_id}|${d}`] ?? { type: 'empty' },
        );
        const scheduledRuns = buildRuns(dates, perDay, scheduledKey);
        const unavailableRuns = buildRuns(dates, perDay, unavailableKey);

        const dragHere = drag?.workerId === w.profile_id;
        const dragStart = dragHere ? Math.min(drag.startIdx, drag.endIdx) : -1;
        const dragEnd = dragHere ? Math.max(drag.startIdx, drag.endIdx) : -1;

        return (
          <div key={w.profile_id} style={gridTemplate} className="grid border-b last:border-0">
            <div className="whitespace-nowrap bg-background px-3 py-2 text-xs font-medium">
              {w.display_name}
            </div>
            <div
              style={{ gridColumn: `2 / span ${days}`, position: 'relative' }}
              className="h-14 bg-background"
            >
              {/* background day cells (clickable) */}
              <div
                className="absolute inset-0 grid"
                style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}
              >
                {dates.map((d, i) => {
                  const dt = new Date(`${d}T00:00`);
                  const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                  const inDrag = dragHere && i >= dragStart && i <= dragEnd;
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`border-l transition-colors ${isWeekend ? 'bg-muted/20' : ''} ${inDrag ? 'bg-primary/20' : ''}`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setDrag({ workerId: w.profile_id, startIdx: i, endIdx: i });
                      }}
                      onPointerEnter={() => {
                        if (drag?.workerId === w.profile_id) {
                          setDrag({ ...drag, endIdx: i });
                        }
                      }}
                      aria-label={`Select ${d} for ${w.display_name}`}
                    />
                  );
                })}
              </div>

              {/* scheduled bars (top half) */}
              {scheduledRuns.map((r) => (
                <div
                  key={`s-${r.startIdx}-${r.endIdx}`}
                  className="pointer-events-none absolute truncate rounded bg-blue-500/80 px-1.5 text-[10px] font-medium text-white"
                  style={{
                    left: `calc(${(r.startIdx / days) * 100}% + 2px)`,
                    width: `calc(${((r.endIdx - r.startIdx + 1) / days) * 100}% - 4px)`,
                    top: 6,
                    height: 18,
                    lineHeight: '18px',
                  }}
                  title={`Scheduled: ${r.label}`}
                >
                  {r.label}
                </div>
              ))}

              {/* unavailable bars (bottom half) */}
              {unavailableRuns.map((r) => (
                <div
                  key={`u-${r.startIdx}-${r.endIdx}`}
                  className="pointer-events-none absolute truncate rounded bg-amber-500/80 px-1.5 text-[10px] font-medium text-white"
                  style={{
                    left: `calc(${(r.startIdx / days) * 100}% + 2px)`,
                    width: `calc(${((r.endIdx - r.startIdx + 1) / days) * 100}% - 4px)`,
                    bottom: 6,
                    height: 18,
                    lineHeight: '18px',
                  }}
                  title={`Unavailable: ${r.label}`}
                >
                  {r.label}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {dialog ? (
        <MarkUnavailableDialog
          key={`${dialog.workerId}-${dialog.from}-${dialog.to}`}
          workerProfileId={dialog.workerId}
          workerName={dialog.workerName}
          from={dialog.from}
          to={dialog.to}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <p className="border-t bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
        Click or drag across days to mark time off.
      </p>
    </div>
  );
}

function MarkUnavailableDialog({
  workerProfileId,
  workerName,
  from: initialFrom,
  to: initialTo,
  onClose,
}: {
  workerProfileId: string;
  workerName: string;
  from: string;
  to: string;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [tag, setTag] = useState<ReasonTag>('vacation');
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    const dates: string[] = [];
    const start = new Date(`${from}T00:00`);
    const end = new Date(`${to}T00:00`);
    if (end < start) {
      toast.error('End date is before start date.');
      return;
    }
    const d = new Date(start);
    while (d <= end) {
      dates.push(d.toLocaleDateString('en-CA'));
      d.setDate(d.getDate() + 1);
    }
    startTransition(async () => {
      const res = await addUnavailabilityAction({
        worker_profile_id: workerProfileId,
        dates,
        reason_tag: tag,
        reason_text: text,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Marked unavailable.');
      onClose();
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {workerName} unavailable</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Reason</Label>
            <Select value={tag} onValueChange={(v) => setTag(v as ReasonTag)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick</SelectItem>
                <SelectItem value="other_job">Other job</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Note (optional)</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Hawaii trip"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
