'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteWorkerInvoiceAction } from '@/server/actions/worker-invoices';

export function WorkerInvoiceWithdrawButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            'Withdraw this invoice? The underlying time & expenses will be available to re-invoice.',
          )
        )
          return;
        start(async () => {
          const res = await deleteWorkerInvoiceAction(id);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success('Invoice withdrawn.');
          router.push('/w/invoices');
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
      Withdraw
    </Button>
  );
}
