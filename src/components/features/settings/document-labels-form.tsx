'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DOCUMENT_LABEL_MAX_LENGTH,
  DOCUMENT_LABEL_SLOTS,
  type DocumentLabelSlot,
} from '@/lib/db/queries/tenant-memory';
import { setDocumentLabelAction } from '@/server/actions/tenant-memory';

type Props = {
  currentLabels: Record<DocumentLabelSlot, string>;
};

type SlotState = { ok: true } | { ok: false; error: string } | null;

function SlotField({ slot, currentValue }: { slot: DocumentLabelSlot; currentValue: string }) {
  const meta = DOCUMENT_LABEL_SLOTS[slot];
  const isDefault = currentValue === meta.default;

  async function action(_prev: SlotState, formData: FormData): Promise<SlotState> {
    const value = formData.get('value') as string;
    return setDocumentLabelAction(slot, value);
  }

  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={`label-${slot}`}>{meta.label}</Label>
        {!isDefault && (
          <span className="text-eyebrow font-mono uppercase tracking-wide text-muted-foreground">
            Custom
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          id={`label-${slot}`}
          name="value"
          defaultValue={isDefault ? '' : currentValue}
          placeholder={meta.default}
          maxLength={DOCUMENT_LABEL_MAX_LENGTH}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok === true && <p className="text-sm text-muted-foreground">Saved.</p>}
      <p className="text-xs text-muted-foreground">
        Leave blank to use the default (&ldquo;{meta.default}&rdquo;). Max{' '}
        {DOCUMENT_LABEL_MAX_LENGTH} characters, plain text only.
      </p>
    </form>
  );
}

export function DocumentLabelsForm({ currentLabels }: Props) {
  return (
    <div className="space-y-6">
      {(Object.keys(DOCUMENT_LABEL_SLOTS) as DocumentLabelSlot[]).map((slot) => (
        <SlotField key={slot} slot={slot} currentValue={currentLabels[slot]} />
      ))}
    </div>
  );
}
