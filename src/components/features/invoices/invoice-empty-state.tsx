import { Receipt } from 'lucide-react';

export function InvoiceEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
      <Receipt className="size-10 text-muted-foreground" />
      <h2 className="text-lg font-semibold">No invoices yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Complete a job and generate an invoice from the job detail page to start getting paid.
      </p>
    </div>
  );
}
