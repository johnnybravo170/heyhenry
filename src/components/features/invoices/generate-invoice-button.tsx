'use client';

import { Loader2, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createInvoiceAction } from '@/server/actions/invoices';

export function GenerateInvoiceButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await createInvoiceAction({ jobId });
      if (result.ok && result.id) {
        toast.success('Invoice created.');
        router.push(`/invoices/${result.id}`);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending} size="sm">
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Receipt className="size-3.5" />}
      Generate invoice
    </Button>
  );
}
