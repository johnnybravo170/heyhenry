'use client';

/**
 * Henry-suggested homeowner decisions, generated from recent project
 * events (memos, notes, photo captions, project description). Lives
 * on the operator's Portal tab below the existing Decision queue.
 *
 * Initial state: a small "Ask Henry" button. Click → fetches
 * suggestions → renders 0-3 dismissible cards. Each card has a
 * one-click "Add to queue" that calls createDecisionAction with
 * the suggested label / description / options pre-filled.
 *
 * AI cluster #4 of the cut-list audit.
 */

import { Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createDecisionAction, suggestDecisionsAction } from '@/server/actions/project-decisions';

type Suggestion = { label: string; description: string | null; options: string[] };

export function DecisionSuggestions({ projectId }: { projectId: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [addingKey, setAddingKey] = useState<string | null>(null);

  function ask() {
    startTransition(async () => {
      const res = await suggestDecisionsAction(projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSuggestions(res.suggestions);
      if (res.suggestions.length === 0) {
        toast('Henry has nothing to suggest right now.');
      }
    });
  }

  function dismiss(s: Suggestion) {
    setSuggestions((prev) => (prev ? prev.filter((p) => p !== s) : prev));
  }

  function add(s: Suggestion) {
    const key = `${s.label}-${s.options.join('|')}`;
    setAddingKey(key);
    startTransition(async () => {
      const res = await createDecisionAction({
        projectId,
        label: s.label,
        description: s.description,
        options: s.options.length > 0 ? s.options : undefined,
      });
      setAddingKey(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Posted to portal');
      dismiss(s);
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-600" aria-hidden />
          <h4 className="text-sm font-semibold">Henry suggests</h4>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={ask}
          disabled={pending}
          className="text-violet-700 hover:bg-violet-100/80 dark:text-violet-300"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {suggestions === null ? 'Ask Henry' : 'Refresh'}
        </Button>
      </div>

      {suggestions === null ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Pulls recent memos, notes, and photo captions to propose decisions worth queueing.
        </p>
      ) : suggestions.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Henry has no suggestions right now — try again after the next memo or photo upload.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {suggestions.map((s) => (
            <li
              key={`${s.label}-${s.options.join('|')}`}
              className="flex items-start gap-2 rounded-md border bg-card p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.label}</p>
                {s.description ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                ) : null}
                {s.options.length > 0 ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Options: {s.options.join(' • ')}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => add(s)}
                  disabled={pending || addingKey === `${s.label}-${s.options.join('|')}`}
                >
                  {addingKey === `${s.label}-${s.options.join('|')}` ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  Add
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Dismiss suggestion"
                  onClick={() => dismiss(s)}
                  disabled={pending}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
