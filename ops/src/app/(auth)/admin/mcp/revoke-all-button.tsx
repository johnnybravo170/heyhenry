'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { revokeAllMcpTokensAction } from './actions';

export function RevokeAllButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (
          !confirm(
            'Revoke ALL active MCP tokens? Every connected client will be forced to re-authorize.',
          )
        )
          return;
        startTransition(async () => {
          const r = await revokeAllMcpTokensAction();
          if (r.ok) {
            toast.success(`Revoked ${r.count} token${r.count === 1 ? '' : 's'}.`);
            router.refresh();
          } else {
            toast.error(r.error);
          }
        });
      }}
      className="rounded-md border border-[var(--destructive)] px-3 py-2 text-sm font-medium text-[var(--destructive)] hover:bg-[var(--destructive)] hover:text-white disabled:opacity-50"
    >
      {isPending ? 'Revoking…' : 'Revoke all MCP tokens'}
    </button>
  );
}
