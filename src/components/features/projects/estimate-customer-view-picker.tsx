'use client';

/**
 * Customer-view mode picker on the operator's estimate preview page.
 *
 * Same toggle UX as the invoice preview's mode picker, but persists
 * immediately to `projects.customer_view_mode` (no "Apply" button) —
 * the estimate render reads its mode from the project on every load,
 * so saving the mode is the apply.
 *
 * When the chosen mode collapses the line-item breakdown (lump_sum,
 * sections), an inline scope-summary editor appears so the operator can
 * author the narrative the client reads in place of the breakdown — saved
 * to `projects.customer_summary_md` on blur (same immediate-save feel as
 * the mode picker). ✦ "Draft with Henry" generates a margin-safe first
 * draft from the scope; the operator edits + approves before it persists.
 *
 * The customer sees whatever is saved when they open the public
 * `/estimate/[code]` link. Operator can preview each mode here first.
 */

import { Eye, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CustomerViewMode } from '@/lib/validators/project-customer-view';
import {
  draftEstimateScopeSummaryAction,
  updateCustomerSummaryAction,
  updateCustomerViewModeAction,
} from '@/server/actions/project-customer-view';

const MODE_CHOICES: Array<{ value: CustomerViewMode; label: string; hint: string }> = [
  { value: 'lump_sum', label: 'Lump sum', hint: 'One total + scope summary.' },
  { value: 'sections', label: 'Sections', hint: 'Customer-facing groupings.' },
  { value: 'categories', label: 'Categories', hint: 'One line per category.' },
  { value: 'detailed', label: 'Detailed', hint: 'Every cost line.' },
];

export function EstimateCustomerViewPicker({
  projectId,
  initialMode,
  initialSummaryMd,
}: {
  projectId: string;
  initialMode: CustomerViewMode;
  initialSummaryMd: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<CustomerViewMode>(initialMode);
  const [pending, startTransition] = useTransition();

  // Scope-summary editor state. `savedSummary` tracks what's persisted so
  // an unchanged blur doesn't re-save (and to drive the "unsaved" hint).
  const [summary, setSummary] = useState(initialSummaryMd ?? '');
  const [savedSummary, setSavedSummary] = useState(initialSummaryMd ?? '');
  const [saving, startSaving] = useTransition();
  const [drafting, startDrafting] = useTransition();

  // lump_sum + sections collapse the breakdown → the client relies on the
  // scope narrative, so surface the editor there. categories/detailed show
  // the work itself, so no narrative is needed.
  const showSummaryEditor = mode === 'lump_sum' || mode === 'sections';
  const dirty = summary.trim() !== savedSummary.trim();

  function pick(next: CustomerViewMode) {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const res = await updateCustomerViewModeAction({ projectId, mode: next });
      if (!res.ok) {
        setMode(previous);
        toast.error(res.error);
        return;
      }
      // Re-render the page so EstimateRender below picks up the new mode.
      router.refresh();
    });
  }

  function saveSummary() {
    if (!dirty) return;
    startSaving(async () => {
      const res = await updateCustomerSummaryAction({
        projectId,
        summaryMd: summary.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSavedSummary(summary.trim());
      toast.success('Scope summary saved.');
      router.refresh();
    });
  }

  function draftWithHenry() {
    startDrafting(async () => {
      const res = await draftEstimateScopeSummaryAction({ projectId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSummary(res.text);
      toast.success('Henry drafted a summary — review and edit, then click out to save.');
    });
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-start gap-2">
          <Eye className="mt-0.5 size-5" />
          <div className="flex-1">
            <CardTitle>Customer view</CardTitle>
            <CardDescription>
              How much of the breakdown the customer sees on this estimate. Saves immediately to the
              project — the preview below and the customer&apos;s shared link both update.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {MODE_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              disabled={pending}
              onClick={() => pick(c.value)}
              className={cn(
                'min-w-0 rounded-md border px-3 py-2 text-left text-xs transition',
                c.value === mode
                  ? 'border-foreground bg-foreground text-background'
                  : 'hover:bg-muted',
                pending && 'opacity-60',
              )}
            >
              <div className="font-medium">{c.label}</div>
              <div
                className={cn(
                  'mt-0.5 text-[10px]',
                  c.value === mode ? 'opacity-80' : 'text-muted-foreground',
                )}
              >
                {c.hint}
              </div>
            </button>
          ))}
        </div>

        {showSummaryEditor ? (
          <div className="space-y-1.5 border-t pt-4">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="scope-summary">
                Scope summary{' '}
                <span className="font-normal text-muted-foreground">
                  — what the client reads in place of the breakdown
                </span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={draftWithHenry}
                disabled={drafting || saving}
                className="text-brand hover:text-brand"
              >
                {drafting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Draft with Henry
              </Button>
            </div>
            <Textarea
              id="scope-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onBlur={saveSummary}
              disabled={drafting}
              rows={5}
              placeholder="Describe the work in plain language — the rooms/areas, the main scope, notable inclusions. No prices; the client sees the total above."
            />
            <p className="text-[10px] text-muted-foreground">
              {saving
                ? 'Saving…'
                : dirty
                  ? 'Unsaved — click out of the box to save.'
                  : 'Saved. Click out of the box after edits to save.'}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
