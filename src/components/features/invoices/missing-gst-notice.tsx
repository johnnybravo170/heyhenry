'use client';

/**
 * Defense-in-depth notice on the operator's invoice detail page when
 * the tenant has no GST/HST number on file. Should be impossible after
 * the first-send gate, but if a draft was created before the gate
 * shipped — or if the field gets cleared — this surfaces it before the
 * operator hits Send.
 */

import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GstNumberPromptDialog } from '@/components/features/shared/gst-number-prompt-dialog';
import { Button } from '@/components/ui/button';
import { statusToneClass } from '@/lib/ui/status-tokens';

export function MissingGstNotice() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`flex items-start gap-3 rounded-r-lg border border-l-2 border-l-brand p-3 ${statusToneClass.danger}`}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col gap-2 text-sm leading-snug">
        <p>
          <span className="font-semibold">No GST/HST number on file.</span> CRA requires your
          GST/HST number on every invoice — add it before sending, we&rsquo;ll block the send
          otherwise.
        </p>
        <div>
          <Button
            size="sm"
            variant="outline"
            className="bg-background"
            onClick={() => setOpen(true)}
          >
            Add GST/HST number
          </Button>
        </div>
      </div>
      <GstNumberPromptDialog
        open={open}
        onOpenChange={setOpen}
        kind="invoice"
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
