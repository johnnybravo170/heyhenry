'use client';

/**
 * Filter bar for the Projects list — replaces the old tab strip.
 *
 * URL-state (`?status=&q=&sort=&dir=`), mirroring the Contacts filter bar:
 *   - status: multi-select toggle chips (planning · awaiting · active · on hold
 *     · declined · complete · cancelled). Default shows planning + awaiting +
 *     active; toggling writes the explicit set. Chips wrap on narrow screens —
 *     no horizontal scroll row (PATTERNS §9).
 *   - q: debounced project-name / customer search.
 *   - attention=overbudget: "needs attention" quick-filter — over-budget
 *     projects only (backed by the denormalized projects.is_over_budget signal).
 *   - sort: column + direction, as sensible presets.
 * Any change resets pagination to page 1.
 */

import { AlertTriangle, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  type LifecycleStage,
  lifecycleStageLabels,
  lifecycleStages,
} from '@/lib/validators/project';

const DEBOUNCE_MS = 300;

const SORT_PRESETS = [
  { value: 'created:desc', label: 'Recently added' },
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'start:asc', label: 'Start (soonest)' },
  { value: 'start:desc', label: 'Start (latest)' },
] as const;

export function ProjectsFilterBar({
  activeStages,
  stageCounts,
  defaultQuery,
  overBudgetActive,
  overBudgetCount,
}: {
  activeStages: LifecycleStage[];
  stageCounts: Record<LifecycleStage, number>;
  defaultQuery: string;
  overBudgetActive: boolean;
  overBudgetCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const [, startTransition] = useTransition();

  const paramsString = searchParams?.toString();
  const active = new Set(activeStages);
  const currentSort = searchParams?.get('sort') ?? 'created';
  const currentDir = searchParams?.get('dir') ?? 'desc';
  const currentSortPreset = `${currentSort}:${currentDir}`;

  // Debounced search → URL. Resets pagination.
  useEffect(() => {
    const params = new URLSearchParams(paramsString);
    const current = params.get('q') ?? '';
    if (query === current) return;
    const id = setTimeout(() => {
      if (query) params.set('q', query);
      else params.delete('q');
      params.delete('page');
      startTransition(() => router.replace(`/projects?${params.toString()}`));
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, paramsString, router]);

  function toggleStage(stage: LifecycleStage) {
    const next = new Set(active);
    if (next.has(stage)) next.delete(stage);
    else next.add(stage);
    const params = new URLSearchParams(searchParams?.toString());
    if (next.size === 0) params.delete('status');
    else params.set('status', lifecycleStages.filter((s) => next.has(s)).join(','));
    params.delete('page');
    startTransition(() => router.replace(`/projects?${params.toString()}`));
  }

  function toggleOverBudget() {
    const params = new URLSearchParams(searchParams?.toString());
    if (overBudgetActive) params.delete('attention');
    else params.set('attention', 'overbudget');
    params.delete('page');
    startTransition(() => router.replace(`/projects?${params.toString()}`));
  }

  function applySort(preset: string) {
    const [sort, dir] = preset.split(':');
    const params = new URLSearchParams(searchParams?.toString());
    params.set('sort', sort);
    params.set('dir', dir);
    params.delete('page');
    startTransition(() => router.replace(`/projects?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex items-center sm:max-w-sm sm:flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects or customers…"
            className="h-9 w-full pl-9 pr-9"
            aria-label="Search projects"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm sm:ml-auto">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sort
          </span>
          <select
            aria-label="Sort projects"
            value={currentSortPreset}
            onChange={(e) => applySort(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {SORT_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Status
        </span>
        {lifecycleStages.map((stage) => {
          const on = active.has(stage);
          return (
            <button
              key={stage}
              type="button"
              onClick={() => toggleStage(stage)}
              aria-pressed={on}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                on
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-muted bg-card text-muted-foreground hover:bg-muted/50',
              )}
            >
              {lifecycleStageLabels[stage]}
              <span
                className={cn('tabular-nums', on ? 'text-background/70' : 'text-foreground/50')}
              >
                {stageCounts[stage]}
              </span>
            </button>
          );
        })}

        {/* "Needs attention" quick-filter — over-budget projects. Disabled
            when none exist so it never reads as an active-but-empty filter. */}
        <button
          type="button"
          onClick={toggleOverBudget}
          aria-pressed={overBudgetActive}
          disabled={overBudgetCount === 0 && !overBudgetActive}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            'ml-1 disabled:cursor-not-allowed disabled:opacity-40',
            overBudgetActive
              ? 'border-amber-600 bg-amber-600 text-white'
              : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/70',
          )}
        >
          <AlertTriangle className="size-3" aria-hidden />
          Needs attention
          <span
            className={cn(
              'tabular-nums',
              overBudgetActive ? 'text-white/70' : 'text-amber-700/60 dark:text-amber-400/60',
            )}
          >
            {overBudgetCount}
          </span>
        </button>
      </div>
    </div>
  );
}
