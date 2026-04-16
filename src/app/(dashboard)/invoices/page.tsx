import { InvoiceEmptyState } from '@/components/features/invoices/invoice-empty-state';
import { InvoiceTable } from '@/components/features/invoices/invoice-table';
import { listInvoices } from '@/lib/db/queries/invoices';

export default async function InvoicesPage() {
  const invoices = await listInvoices();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">Track payments for completed jobs.</p>
      </div>

      {invoices.length === 0 ? <InvoiceEmptyState /> : <InvoiceTable invoices={invoices} />}
    </div>
  );
}
