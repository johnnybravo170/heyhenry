'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { revokeMcpTokenAction } from './actions';

export function RevokeTokenButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm('Revoke this MCP token? The client will need to re-authorize.')) return;
        startTransition(async () => {
          const r = await revokeMcpTokenAction(id);
          if (r.ok) {
            toast.success('Token revoked.');
            router.refresh();
          } else {
            toast.error(r.error);
          }
        });
      }}
      className="text-xs text-[var(--destructive)] hover:underline"
    >
      revoke
    </button>
  );
}
