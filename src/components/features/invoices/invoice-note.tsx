'use client';

import { MessageSquare, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { updateInvoiceNoteAction } from '@/server/actions/invoices';

export function InvoiceNote({
  invoiceId,
  note,
  isDraft,
}: {
  invoiceId: string;
  note: string | null;
  isDraft: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? '');

  function handleSave() {
    startTransition(async () => {
      const result = await updateInvoiceNoteAction({ invoiceId, note: value });
      if (!result.ok) {
        toast.error(result.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (!note && !isDraft) return null;

  if (editing) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <label
          htmlFor="customer-note"
          className="mb-2 block text-sm font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Customer note
        </label>
        <textarea
          id="customer-note"
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          rows={3}
          placeholder="Add a personalized message for the customer..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
        />
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setValue(note ?? '');
            }}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (note) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <header className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Customer note
            </h2>
          </div>
          {isDraft && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3" />
              Edit
            </Button>
          )}
        </header>
        <p className="whitespace-pre-wrap text-sm text-foreground">{note}</p>
      </section>
    );
  }

  // No note yet, draft mode, show add button
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-fit"
      onClick={() => setEditing(true)}
    >
      <MessageSquare className="size-3.5" />
      Add customer note
    </Button>
  );
}
