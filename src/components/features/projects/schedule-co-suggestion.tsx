'use client';

/**
 * Henry CO → schedule prompt — the third embedded-Henry touchpoint on the
 * Schedule tab (brief §"Henry intelligence touchpoints" #3, closing vault
 * gotcha #13: change orders are NOT linked to the Gantt). When a change
 * order is approved, Henry offers inline:
 *
 *   "✦ The approved change order ‘Ensuite upgrade’ (+$4,200) adds new
 *    scope — draft it onto the schedule?"
 *      ☑ Tiling          +$3,100   [editable name]
 *      ☑ Plumbing fixtures +$1,100 [editable name]
 *    Add after [Drywall ▾]   [Add to schedule]  [Dismiss]
 *
 * Accepting drafts one rough, internal (client-hidden) task per included
 * scope item, optionally wired after the chosen predecessor. Nothing is
 * auto-inserted — the operator accepts/edits or dismisses, and either path
 * stops the re-nag (dedup via change_orders.schedule_suggestion_dismissed_at).
 *
 * Rust ✦ + left-border warn-soft chrome — the same Henry convention as the
 * cascade explainer + slip prompt (PATTERNS §27). Money via `<Money>`/CAD,
 * the only place dollars leak onto the otherwise money-free Schedule tab.
 */

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CoScheduleSuggestion } from '@/lib/db/queries/project-schedule';
import { statusToneClass } from '@/lib/ui/status-tokens';

/** A scope item the operator chose to draft, with its (possibly edited) name. */
export type AcceptedCoItem = { name: string };

const NO_PREDECESSOR = '__none__';

function CoSuggestionCard({
  suggestion,
  taskOptions,
  onAccept,
  onDismiss,
}: {
  suggestion: CoScheduleSuggestion;
  taskOptions: Array<{ id: string; name: string }>;
  onAccept: (coId: string, predecessorId: string | null, items: AcceptedCoItem[]) => void;
  onDismiss: (coId: string) => void;
}) {
  const [names, setNames] = useState<string[]>(suggestion.scopes.map((s) => s.name));
  const [included, setIncluded] = useState<boolean[]>(suggestion.scopes.map(() => true));
  const [predecessorId, setPredecessorId] = useState<string>(NO_PREDECESSOR);

  const chosen = suggestion.scopes
    .map((_, i) => ({ name: names[i].trim(), include: included[i] }))
    .filter((x) => x.include && x.name.length > 0);

  const handleAdd = () => {
    if (chosen.length === 0) return;
    onAccept(
      suggestion.coId,
      predecessorId === NO_PREDECESSOR ? null : predecessorId,
      chosen.map((x) => ({ name: x.name })),
    );
  };

  const multi = suggestion.scopes.length > 1;

  return (
    <div className={`rounded-r-lg border border-l-2 border-l-brand p-3 ${statusToneClass.warning}`}>
      <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-brand">
        <Sparkles className="size-3" aria-hidden />
        Henry
      </div>

      <p className="text-sm leading-snug text-foreground">
        The approved change order <span className="font-medium">{suggestion.title}</span> (
        <Money cents={suggestion.costImpactCents} signed />) adds{' '}
        {multi ? 'new scope' : <span className="font-medium">{suggestion.scopes[0].name}</span>} —
        draft it onto the schedule?
      </p>

      {/* Scope rows — each a draftable task: include toggle + editable name. */}
      <ul className="mt-2 space-y-1.5">
        {suggestion.scopes.map((scope, i) => (
          <li key={`${suggestion.coId}-${scope.name}`} className="flex items-center gap-2">
            <Checkbox
              checked={included[i]}
              onCheckedChange={(v) =>
                setIncluded((prev) => prev.map((p, idx) => (idx === i ? v === true : p)))
              }
              aria-label={`Include ${scope.name}`}
              className="bg-background"
            />
            <Input
              value={names[i]}
              onChange={(e) =>
                setNames((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
              }
              disabled={!included[i]}
              aria-label={`Task name for ${scope.name}`}
              className="h-8 flex-1 bg-background text-sm"
            />
            <span className="shrink-0 text-xs text-muted-foreground">
              <Money cents={scope.addedCents} />
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor={`co-pred-${suggestion.coId}`}>
          Add after
        </label>
        <Select value={predecessorId} onValueChange={setPredecessorId}>
          <SelectTrigger
            id={`co-pred-${suggestion.coId}`}
            size="sm"
            className="h-8 w-[200px] bg-background"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PREDECESSOR}>Start of schedule</SelectItem>
            {taskOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-background"
          disabled={chosen.length === 0}
          onClick={handleAdd}
        >
          Add to schedule
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto text-muted-foreground"
          onClick={() => onDismiss(suggestion.coId)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function ScheduleCoSuggestion({
  suggestions,
  taskOptions,
  onAccept,
  onDismiss,
}: {
  suggestions: CoScheduleSuggestion[];
  /** Existing tasks for the "Add after" predecessor picker (display order). */
  taskOptions: Array<{ id: string; name: string }>;
  onAccept: (coId: string, predecessorId: string | null, items: AcceptedCoItem[]) => void;
  onDismiss: (coId: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      {suggestions.map((s) => (
        <CoSuggestionCard
          key={s.coId}
          suggestion={s}
          taskOptions={taskOptions}
          onAccept={onAccept}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
