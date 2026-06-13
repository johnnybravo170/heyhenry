import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { UserMembership } from '@/lib/db/queries/memberships';
import { QuickLogExpenseButton } from './quick-log-expense-button';
import { QuickLogTimeButton } from './quick-log-time-button';
import { WorkspaceSwitcher } from './workspace-switcher';

type HeaderProps = {
  ownerRateCents?: number | null;
  /** Tenant's effective GST/HST rate (decimal). 0 disables the
   *  auto-split tax chip on the Log Expense dialog. */
  tenantTaxRate: number;
  memberships: UserMembership[];
  activeTenantId: string | null;
  isAdmin?: boolean;
};

export function Header({
  ownerRateCents,
  tenantTaxRate,
  memberships,
  activeTenantId,
  isAdmin,
}: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-end border-b bg-sidebar px-4">
      {/* Mobile primary nav lives in OwnerBottomNav (incl. its More sheet), so
          the header no longer carries the hamburger drawer on mobile. The
          desktop sidebar (SidebarNav) handles md+ navigation. */}
      <div className="flex items-center gap-2">
        <QuickLogTimeButton ownerRateCents={ownerRateCents ?? null} />
        <QuickLogExpenseButton tenantTaxRate={tenantTaxRate} />
        {/*
         * Single "New Project" entry per the Universal Intake decision
         * (worklog 15839262, 2026-04-22) and the smart-selection MO —
         * Henry sorts what was dropped, the operator doesn't pre-classify.
         * /projects/new accepts everything: voice memos, text threads,
         * photos, sub-trade quotes, sketches, paste, manual entry.
         */}
        <Button size="sm" className="min-h-11 min-w-11 gap-1 sm:min-h-0 sm:min-w-0" asChild>
          <Link href="/projects/new">
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">New Project</span>
          </Link>
        </Button>

        <WorkspaceSwitcher
          memberships={memberships}
          activeTenantId={activeTenantId}
          isAdmin={isAdmin}
        />
      </div>
    </header>
  );
}
