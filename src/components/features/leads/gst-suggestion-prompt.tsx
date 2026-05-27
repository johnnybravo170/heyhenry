'use client';

/**
 * Inline "we noticed your GST number — save it?" prompt on the intake review.
 * Self-contained: asks the server whether the parsed `detected_tax_ids` contain
 * the operator's own number worth saving, and only renders if so. Card 015406d5.
 *
 * Visual is intentionally plain — OD restyles in its review-screen pass.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatGstNumber } from '@/lib/validators/tax-id';
import {
  type DetectedTaxId,
  dismissGstNumberAction,
  evaluateGstSuggestionAction,
  saveTenantGstNumberAction,
} from '@/server/actions/gst-suggestion';

export function GstSuggestionPrompt({ detectedTaxIds }: { detectedTaxIds: DetectedTaxId[] }) {
  const [number, setNumber] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    if (!detectedTaxIds || detectedTaxIds.length === 0) return;
    evaluateGstSuggestionAction(detectedTaxIds)
      .then((res) => {
        if (active && res) setNumber(res.number);
      })
      .catch(() => {
        // Suggestion is a nicety — never block the review on it.
      });
    return () => {
      active = false;
    };
  }, [detectedTaxIds]);

  if (done || !number) return null;

  function save() {
    if (!number) return;
    setBusy(true);
    saveTenantGstNumberAction(number).then((res) => {
      setBusy(false);
      if (res.ok) {
        toast.success('Saved your GST/HST number to your business profile.');
        setDone(true);
      } else {
        toast.error(res.error);
      }
    });
  }

  function dismiss() {
    if (!number) return;
    setBusy(true);
    dismissGstNumberAction(number).then(() => {
      setBusy(false);
      setDone(true);
    });
  }

  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
      <p>
        We spotted a GST/HST number on this document:{' '}
        <span className="font-mono font-medium">{formatGstNumber(number)}</span>. Is this yours?
        Save it and it'll show on your invoices and estimates, so you won't have to enter it later.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={busy}>
          Yes, save it
        </Button>
        <Button size="sm" variant="outline" onClick={dismiss} disabled={busy}>
          Not mine
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDone(true)} disabled={busy}>
          Skip
        </Button>
      </div>
    </div>
  );
}
