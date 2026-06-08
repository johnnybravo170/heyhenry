'use client';

/**
 * QBO Class → HH Project mapping UI.
 *
 * One row per distinct QuickBooks Class found across bills + receipts
 * (project_costs where source_type='receipt'; the legacy `expenses` table
 * is gone), sorted by total spend (CAD). Per row: a project picker + Apply.
 * The picker stages a selection locally; "Apply" runs the bulk update.
 *
 * "Overwrite existing" (consequence-clear) re-tags rows already pointed at a
 * *different* project; default OFF (the safe `preserveExisting` path).
 *
 * Henry (✦) pre-stages the Select for an unmapped class whose name strongly
 * implies a project — labelled `✦ suggested`, confirmed on Apply. Never
 * auto-applies.
 */

import { Check, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/pricing/calculator';
import { statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import {
  applyClassMappingAction,
  type ClassMappingSummary,
} from '@/server/actions/qbo-class-mapping';

const UNMAPPED = '__none__';

type Props = {
  classes: ClassMappingSummary[];
  projects: Array<{ id: string; name: string }>;
};

/** Normalize a label for fuzzy name matching (lowercase alphanumerics). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Henry's class→project suggestion: an unmapped class whose normalized name
 * strongly overlaps a project name. Returns the project id to pre-stage, or
 * null. Conservative — only suggests on a clear containment match so a wrong
 * guess never silently mis-tags spend.
 */
function suggestProject(
  className: string,
  projects: Array<{ id: string; name: string }>,
): string | null {
  const c = norm(className);
  if (!c) return null;
  for (const p of projects) {
    const n = norm(p.name);
    if (!n) continue;
    if (c === n || c.includes(n) || n.includes(c)) return p.id;
  }
  return null;
}

export function QboClassMapping({ classes, projects }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeClass, setActiveClass] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(false);

  // Henry's suggestions for unmapped classes — computed once. The Select is
  // pre-staged to the suggestion but the operator must confirm with Apply.
  const suggestions = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of classes) {
      if (c.current_project_id) continue;
      const sug = suggestProject(c.qbo_class_name, projects);
      if (sug) out[c.qbo_class_name] = sug;
    }
    return out;
  }, [classes, projects]);

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of classes) {
      // Pre-stage Henry's suggestion when present; otherwise current mapping.
      init[c.qbo_class_name] =
        c.current_project_id ?? suggestProject(c.qbo_class_name, projects) ?? UNMAPPED;
    }
    return init;
  });

  function apply(className: string) {
    const projectChoice = selections[className] ?? UNMAPPED;
    const projectId = projectChoice === UNMAPPED ? null : projectChoice;
    setActiveClass(className);
    startTransition(async () => {
      const result = await applyClassMappingAction({
        qboClassName: className,
        projectId,
        preserveExisting: !overwrite,
      });
      if (result.ok) {
        const total = result.bills_updated + result.expenses_updated;
        toast.success(
          total === 0
            ? 'Nothing to update.'
            : `Tagged ${total} record${total === 1 ? '' : 's'} (${result.bills_updated} bills, ${result.expenses_updated} receipts).`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setActiveClass(null);
    });
  }

  if (classes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No QuickBooks Classes in your imports</CardTitle>
          <CardDescription>
            Either your QuickBooks company doesn&rsquo;t use Classes, or no bills / receipts in your
            imports had one set. Class assignment lives on each line in QBO — the importer captures
            the first non-empty class it finds on each record.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const unmappedCount = classes.filter((c) => !c.current_project_id).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Map QuickBooks Classes to projects</CardTitle>
            <CardDescription className="max-w-xl">
              {classes.length} distinct class{classes.length === 1 ? '' : 'es'} across your imported
              bills and receipts
              {unmappedCount > 0 ? ` · ${unmappedCount} unmapped` : ''}. Point each one at the
              HeyHenry project it belongs to — records get tagged in bulk so spend rolls up under
              the right job.
            </CardDescription>
          </div>

          {/* Overwrite existing — labelled, consequence-clear, default OFF.
              When on, re-tags rows already pointed at a *different* project. */}
          <label className="flex max-w-xs cursor-pointer items-start gap-2.5 rounded-lg border bg-muted/30 p-3">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="mt-0.5 size-4 rounded border-input"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Overwrite existing</span>
              <span className="text-xs text-muted-foreground">
                Re-tag rows already assigned to another project. Off keeps your manual edits.
              </span>
            </span>
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {classes.map((c) => {
          const isPending = pending && activeClass === c.qbo_class_name;
          const currentSelection = selections[c.qbo_class_name] ?? UNMAPPED;
          const suggestedId = suggestions[c.qbo_class_name];
          const isShowingSuggestion = Boolean(suggestedId) && currentSelection === suggestedId;
          return (
            <div
              key={c.qbo_class_name}
              className={cn(
                'grid grid-cols-1 items-center gap-3 rounded-lg border p-3 text-sm sm:grid-cols-[1fr_240px_auto]',
                isShowingSuggestion ? 'border-brand/40 bg-brand/5' : 'bg-muted/20',
              )}
            >
              <div className="min-w-0">
                <p className="font-medium">{c.qbo_class_name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {c.bill_count} bill{c.bill_count === 1 ? '' : 's'} · {c.expense_count} receipt
                    {c.expense_count === 1 ? '' : 's'} ·{' '}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(c.total_cents)}
                    </span>
                  </span>
                  {c.current_project_name && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium',
                        statusToneClass.neutral,
                      )}
                    >
                      currently → {c.current_project_name}
                    </span>
                  )}
                  {isShowingSuggestion && (
                    <span className="inline-flex items-center gap-1 font-medium text-brand">
                      <Sparkles className="size-3" aria-hidden="true" />
                      suggested
                    </span>
                  )}
                </p>
              </div>
              <Select
                value={currentSelection}
                onValueChange={(v) => setSelections((s) => ({ ...s, [c.qbo_class_name]: v }))}
              >
                <SelectTrigger className={cn('w-full', isShowingSuggestion && 'border-brand/60')}>
                  <SelectValue />
                  <ChevronDown className="size-3.5 opacity-50" aria-hidden="true" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNMAPPED}>— No project —</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => apply(c.qbo_class_name)}
                disabled={isPending}
                className="justify-self-end"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Apply
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
