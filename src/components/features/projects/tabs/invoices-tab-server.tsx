import { InvoicesTab } from '@/components/features/projects/invoices-tab';
import { createClient } from '@/lib/supabase/server';

export default async function InvoicesTabServer({ projectId }: { projectId: string }) {
  const supabase = await createClient();
  const { data: projectInvoices } = await supabase
    .from('invoices')
    .select('id, status, amount_cents, tax_cents, customer_note, created_at')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return (
    <InvoicesTab
      projectId={projectId}
      invoices={(projectInvoices ?? []).map((inv) => ({
        id: inv.id as string,
        status: inv.status as string,
        amount_cents: inv.amount_cents as number,
        tax_cents: inv.tax_cents as number,
        customer_note: inv.customer_note as string | null,
        created_at: inv.created_at as string,
      }))}
    />
  );
}
