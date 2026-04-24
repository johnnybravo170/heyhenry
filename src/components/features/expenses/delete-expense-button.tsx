'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteOverheadExpenseAction } from '@/server/actions/overhead-expenses';

/**
 * Tiny per-row delete control for the overhead expenses list. Uses a
 * native confirm so this stays a one-click UI — overhead expense entry
 * is a low-stakes mutation (easy to re-enter from the receipt if you
 * change your mind) and a full AlertDialog per row adds nothing.
 */
export function DeleteExpenseButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Delete expense "${label}"? This removes the receipt too.`)) return;
    startTransition(async () => {
      const res = await deleteOverheadExpenseAction(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Expense deleted');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-muted-foreground transition-colors hover:text-red-600 disabled:opacity-50"
      aria-label={`Delete ${label}`}
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
