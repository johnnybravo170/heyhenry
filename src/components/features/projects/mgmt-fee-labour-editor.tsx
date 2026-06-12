'use client';

/**
 * Per-project toggle for apply_mgmt_fee_to_labour.
 * Sibling to BillingModeEditor on the Overview facts grid.
 *
 * NULL = inherit tenant default (shown as the effective resolved value).
 * Operator can pin true/false at the project level to override.
 */

import { Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { updateProjectApplyMgmtFeeToLabourAction } from '@/server/actions/projects';

type Props = {
  projectId: string;
  /** NULL = inheriting tenant default. Resolved effective value shown. */
  applyMgmtFeeToLabour: boolean | null;
  /** The tenant default, so we can show the effective value when null. */
  tenantDefault: boolean;
};

export function MgmtFeeLabourEditor({ projectId, applyMgmtFeeToLabour, tenantDefault }: Props) {
  const [value, setValue] = useState(applyMgmtFeeToLabour);
  const [isPending, startTransition] = useTransition();

  const effective = value ?? tenantDefault;

  function set(next: boolean | null) {
    if (next === value || isPending) return;
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const res = await updateProjectApplyMgmtFeeToLabourAction({
        id: projectId,
        applyMgmtFeeToLabour: next,
      });
      if (!res.ok) {
        setValue(previous);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <fieldset
        className={cn(
          'inline-flex rounded-md border bg-muted/50 p-0.5 text-xs',
          isPending && 'opacity-60',
        )}
        aria-label="Management fee on labour"
      >
        <button
          type="button"
          onClick={() => set(true)}
          disabled={isPending}
          aria-pressed={effective === true}
          className={cn(
            'rounded px-2 py-1 font-medium transition-colors',
            effective
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Labour + materials
        </button>
        <button
          type="button"
          onClick={() => set(false)}
          disabled={isPending}
          aria-pressed={effective === false}
          className={cn(
            'rounded px-2 py-1 font-medium transition-colors',
            !effective
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Materials only
        </button>
      </fieldset>
      {value !== null ? (
        <button
          type="button"
          onClick={() => set(null)}
          disabled={isPending}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Reset to default
        </button>
      ) : (
        <span className="text-xs text-muted-foreground">(tenant default)</span>
      )}
      {isPending ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
    </div>
  );
}
