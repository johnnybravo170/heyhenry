'use client';

import { Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { updateWorkerDefaultsAction } from '@/server/actions/worker-profiles';

type Props = {
  workersCanLogExpenses: boolean;
  workersCanInvoiceDefault: boolean;
};

export function WorkerDefaultsCard({ workersCanLogExpenses, workersCanInvoiceDefault }: Props) {
  const [pending, startTransition] = useTransition();
  const [logExpenses, setLogExpenses] = useState(workersCanLogExpenses);
  const [invoice, setInvoice] = useState(workersCanInvoiceDefault);

  function handleSave() {
    startTransition(async () => {
      const result = await updateWorkerDefaultsAction({
        workers_can_log_expenses: logExpenses,
        workers_can_invoice_default: invoice,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to save.');
        return;
      }
      toast.success('Defaults saved.');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Worker defaults</CardTitle>
        <CardDescription>
          Applies to every worker unless overridden on their row below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            id="workers_can_log_expenses"
            checked={logExpenses}
            onCheckedChange={(v) => setLogExpenses(v === true)}
          />
          <Label htmlFor="workers_can_log_expenses" className="font-normal">
            Workers can log expenses
          </Label>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            id="workers_can_invoice_default"
            checked={invoice}
            onCheckedChange={(v) => setInvoice(v === true)}
          />
          <Label htmlFor="workers_can_invoice_default" className="font-normal">
            Workers can submit invoices (typical for subcontractors)
          </Label>
        </div>
        <Button onClick={handleSave} disabled={pending} size="sm">
          {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save defaults
        </Button>
      </CardContent>
    </Card>
  );
}
