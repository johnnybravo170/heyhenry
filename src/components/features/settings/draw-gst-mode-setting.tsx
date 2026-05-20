'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { DrawGstMode } from '@/lib/invoices/draw-gst-mode';
import { setTenantDrawGstModeAction } from '@/server/actions/invoices';

/**
 * Tenant-default control for how GST is shown on draws. Individual projects
 * can override this on their Billing tab; this sets the fallback for any
 * project that hasn't.
 */
export function DrawGstModeSetting({ initial }: { initial: DrawGstMode }) {
  const [mode, setMode] = useState<DrawGstMode>(initial);
  const [pending, startTransition] = useTransition();

  function handleChange(next: DrawGstMode) {
    const prev = mode;
    setMode(next);
    startTransition(async () => {
      const res = await setTenantDrawGstModeAction({ mode: next });
      if (res.ok) {
        toast.success('Default updated.');
      } else {
        setMode(prev);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold">GST on draws</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        How GST appears on milestone draws by default. Affects only new draws; sent draws are
        unchanged. A project can override this on its Billing tab.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="draw-gst-mode"
            className="mt-1"
            checked={mode === 'inclusive'}
            onChange={() => handleChange('inclusive')}
            disabled={pending}
          />
          <span>
            <span className="font-medium">GST included</span> — you type the all-in total; GST is
            shown embedded ("incl. $X GST").
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="draw-gst-mode"
            className="mt-1"
            checked={mode === 'on_top'}
            onChange={() => handleChange('on_top')}
            disabled={pending}
          />
          <span>
            <span className="font-medium">GST on top</span> — you type the pre-tax subtotal; GST is
            added ("+ $X GST").
          </span>
        </label>
      </div>
    </div>
  );
}
