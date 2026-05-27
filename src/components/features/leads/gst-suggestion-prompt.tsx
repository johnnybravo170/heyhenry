'use client';

/**
 * Inline GST-number prompt on the intake review. Self-contained: asks the
 * server whether the parsed `detected_tax_ids` contain a number worth acting on
 * and only renders if so. Two cases (cards 015406d5 + dc77f067):
 *   - owner: it's the operator's own number → offer to save to their profile.
 *   - sub:   it's an outside business's number on a quote → offer to add them as
 *            a contact and log the number.
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
  type GstSuggestion,
  saveSubContactGstAction,
  saveTenantGstNumberAction,
} from '@/server/actions/gst-suggestion';

export function GstSuggestionPrompt({ detectedTaxIds }: { detectedTaxIds: DetectedTaxId[] }) {
  const [suggestion, setSuggestion] = useState<GstSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    if (!detectedTaxIds || detectedTaxIds.length === 0) return;
    evaluateGstSuggestionAction(detectedTaxIds)
      .then((res) => {
        if (active && res) setSuggestion(res);
      })
      .catch(() => {
        // Suggestion is a nicety — never block the review on it.
      });
    return () => {
      active = false;
    };
  }, [detectedTaxIds]);

  if (done || !suggestion) return null;

  function accept() {
    if (!suggestion) return;
    setBusy(true);
    const promise =
      suggestion.kind === 'owner'
        ? saveTenantGstNumberAction(suggestion.number)
        : saveSubContactGstAction(suggestion.number, suggestion.businessName);
    promise.then((res) => {
      setBusy(false);
      if (res.ok) {
        toast.success(
          suggestion.kind === 'owner'
            ? 'Saved your GST/HST number to your business profile.'
            : `Added ${suggestion.businessName} as a contact with their GST/HST number.`,
        );
        setDone(true);
      } else {
        toast.error(res.error);
      }
    });
  }

  function dismiss() {
    if (!suggestion) return;
    setBusy(true);
    dismissGstNumberAction(suggestion.number).then(() => {
      setBusy(false);
      setDone(true);
    });
  }

  const formatted = formatGstNumber(suggestion.number);

  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
      {suggestion.kind === 'owner' ? (
        <>
          <p>
            We spotted a GST/HST number on this document:{' '}
            <span className="font-mono font-medium">{formatted}</span>. Is this yours? Save it and
            it'll show on your invoices and estimates, so you won't have to enter it later.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={accept} disabled={busy}>
              Yes, save it
            </Button>
            <Button size="sm" variant="outline" onClick={dismiss} disabled={busy}>
              Not mine
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDone(true)} disabled={busy}>
              Skip
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>
            This looks like a quote from{' '}
            <span className="font-medium">{suggestion.businessName}</span> (GST/HST{' '}
            <span className="font-mono">{formatted}</span>). Add them as a contact? We'll save their
            GST number on their card.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={accept} disabled={busy}>
              Add contact
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
              Not now
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
