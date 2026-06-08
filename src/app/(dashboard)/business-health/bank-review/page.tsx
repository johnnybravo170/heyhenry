import { Monitor } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BankReviewQueue } from '@/components/features/bank-review/bank-review-queue';
import { RetryCard } from '@/components/features/bank-review/retry-card';
import { OwnerOnlyPane } from '@/components/features/settings/owner-only-pane';
import { Button } from '@/components/ui/button';
import { getCurrentTenant } from '@/lib/auth/helpers';
import {
  type BankReviewRow,
  listBankReviewQueue,
  listImportedStatements,
} from '@/lib/db/queries/bank-review-queue';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Review bank matches',
};

export default async function BankReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ statement?: string; include_unmatched?: string }>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/login');

  // Role gate — DECIDED owner+admin only. This surface WRITES paid-state
  // (flips invoices/bills to paid), so it's gated tighter than read-only
  // money views. Members get the calm refusal pane, not a crash.
  // FLAG FOR OPS: loosen to members only by explicit decision — never below
  // owner+admin, since confirming here mutates money state.
  const role = tenant.member.role;
  if (role !== 'owner' && role !== 'admin') {
    return (
      <OwnerOnlyPane
        title="Bank match review"
        description={`Reviewing bank matches marks invoices and bills paid for ${tenant.name}, so it's handled by the owner and admins.`}
      />
    );
  }

  const params = await searchParams;
  const filters = {
    statement_id: params.statement,
    include_unmatched: params.include_unmatched === '1',
  };

  // listBankReviewQueue throws on query error; catch it and degrade to a
  // calm retry card instead of bubbling to the route's 500 boundary.
  let data: {
    rows: BankReviewRow[];
    counts: Awaited<ReturnType<typeof listBankReviewQueue>>['counts'];
  } | null = null;
  let statements: Awaited<ReturnType<typeof listImportedStatements>> = [];
  let loadError = false;
  try {
    [data, statements] = await Promise.all([
      listBankReviewQueue(filters),
      listImportedStatements(),
    ]);
  } catch {
    loadError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold sm:text-2xl">Review bank matches</h1>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/business-health">← Business Health</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/business-health/bank-import">Import another statement</Link>
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Confirm the matches we found between your bank statement and your unpaid invoices,
          expenses, and bills. High-confidence matches are pre-checked — confirm in bulk.
        </p>
      </header>

      {/* Mobile: thinking/admin work — redirect to desktop, don't force a
          multi-column review grid onto a phone. */}
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center lg:hidden">
        <Monitor className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Review matches on a larger screen</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Confirming bank matches is multi-select desktop work. Open HeyHenry on a laptop or desktop
          to review and bulk-confirm.
        </p>
      </div>

      <div className="hidden lg:block">
        {loadError || !data ? (
          <RetryCard />
        ) : (
          <BankReviewQueue
            initialRows={data.rows}
            counts={data.counts}
            statements={statements}
            filters={filters}
          />
        )}
      </div>
    </div>
  );
}
