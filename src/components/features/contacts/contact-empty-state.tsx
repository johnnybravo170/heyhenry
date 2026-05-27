import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Centered empty state for the customer list. Two variants:
 * - "fresh" (no customers at all) encourages creating the first one
 * - "filtered" (customers exist but search/filter returned zero) encourages
 *   clearing the filter
 */
export function ContactEmptyState({ variant }: { variant: 'fresh' | 'filtered' }) {
  if (variant === 'filtered') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card py-16 text-center">
        <p className="text-sm font-medium">No contacts match these filters.</p>
        <p className="text-sm text-muted-foreground">
          Try a different name, or clear the filter to see everyone.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/contacts">Clear filters</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-card py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <UserPlus className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">No contacts yet</h2>
        <p className="text-sm text-muted-foreground">
          Add your first customer, vendor, or sub — or import your list with Henry.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/contacts/new">Add a contact</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/contacts/import">Import with Henry</Link>
        </Button>
      </div>
    </div>
  );
}
