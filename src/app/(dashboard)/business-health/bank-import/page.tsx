import { Info, Monitor } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BankImportFlow } from '@/components/features/bank-import/bank-import-flow';
import { OwnerOnlyPane } from '@/components/features/settings/owner-only-pane';
import { Button } from '@/components/ui/button';
import { getCurrentTenant } from '@/lib/auth/helpers';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Import bank statement',
};

export default async function BankImportPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/login');

  // Role gate — DECIDED owner+admin only. Import feeds the review queue,
  // which writes paid-state; gate the whole flow to match.
  // FLAG FOR OPS: loosen to members only by explicit decision — never below
  // owner+admin.
  const role = tenant.member.role;
  if (role !== 'owner' && role !== 'admin') {
    return (
      <OwnerOnlyPane
        title="Import bank statement"
        description={`Importing statements and confirming matches marks invoices paid for ${tenant.name}, so it's handled by the owner and admins.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold sm:text-2xl">Import bank statement</h1>
          <Button asChild variant="ghost" size="sm">
            <Link href="/business-health">← Business Health</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Save yourself from clicking "mark paid" 50 times a month. Drop your monthly statement and
          we'll find every invoice and expense already in HeyHenry that matches a transaction —
          confirm in one click.
        </p>
      </header>

      <aside className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
        <div className="mb-1 flex items-center gap-1.5 font-medium">
          <Info className="size-3.5" aria-hidden />
          What this is (and isn't)
        </div>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Is:</strong> a payment shortcut. We match bank lines to unpaid invoices,
            expenses, and bills you've already entered, and let you mark them paid in bulk.
          </li>
          <li>
            <strong>Isn't:</strong> bank reconciliation. Your bookkeeper still does that in
            QuickBooks against QBO's bank feed — we don't try to replace it.
          </li>
          <li>
            Transfers, fees, interest, ATM withdrawals — anything that isn't an invoice or expense —
            get left alone here. Those belong in QBO.
          </li>
        </ul>
      </aside>

      {/* Mobile: file-pick + column-mapping are hostile on a phone — this is
          desktop work. Redirect, don't force it. */}
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center lg:hidden">
        <Monitor className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Import on a larger screen</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Picking a CSV and mapping columns works best on a laptop or desktop. Open HeyHenry there
          to import a statement.
        </p>
      </div>

      <div className="hidden lg:block">
        <BankImportFlow />
      </div>
    </div>
  );
}
