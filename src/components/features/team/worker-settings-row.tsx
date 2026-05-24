'use client';

/**
 * The per-worker capability + rate editor, revealed behind a deliberate
 * row-expand (NOT auto-open — gap 2). Pay/charge are sensitive cost data:
 *
 *  - The whole editor carries a gate pill ("Owner / Admin · not visible to
 *    {worker}") — these fields never reach the worker, members, or clients.
 *  - The Labour-margin read (pay→charge delta) is OWNER-ONLY: a render gate
 *    on existing data. Admins edit pay/charge but don't see the margin cue.
 *
 * Reuses the existing `updateWorkerCapabilitiesAction` — no new mutation.
 */

import { Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/ui/money';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateWorkerCapabilitiesAction } from '@/server/actions/worker-profiles';

type WorkerProfile = {
  id: string;
  worker_type: 'employee' | 'subcontractor';
  can_log_expenses: boolean | null;
  can_invoice: boolean | null;
  default_hourly_rate_cents: number | null;
  default_charge_rate_cents: number | null;
};

function boolToTri(v: boolean | null): 'inherit' | 'yes' | 'no' {
  if (v === null) return 'inherit';
  return v ? 'yes' : 'no';
}

/** Parse a dollar string to whole cents, or null when blank/invalid. */
function dollarsToCents(v: string): number | null {
  const n = Number(v);
  if (!v.trim() || Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function WorkerSettingsRow({
  profile,
  workerName,
  isOwnerViewer,
}: {
  profile: WorkerProfile;
  /** First name / display for the gate pill ("not visible to Cory"). */
  workerName: string;
  /** Owner sees the Labour-margin read; admin does not. */
  isOwnerViewer: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [workerType, setWorkerType] = useState(profile.worker_type);
  const [canLogExpenses, setCanLogExpenses] = useState(boolToTri(profile.can_log_expenses));
  const [canInvoice, setCanInvoice] = useState(boolToTri(profile.can_invoice));
  const [payRate, setPayRate] = useState(
    profile.default_hourly_rate_cents !== null
      ? (profile.default_hourly_rate_cents / 100).toFixed(2)
      : '',
  );
  const [chargeRate, setChargeRate] = useState(
    profile.default_charge_rate_cents !== null
      ? (profile.default_charge_rate_cents / 100).toFixed(2)
      : '',
  );

  const payCents = dollarsToCents(payRate);
  const chargeCents = dollarsToCents(chargeRate);
  const marginCents = payCents !== null && chargeCents !== null ? chargeCents - payCents : null;
  const marginPct =
    marginCents !== null && chargeCents && chargeCents > 0
      ? Math.round((marginCents / chargeCents) * 100)
      : null;

  function handleSave() {
    startTransition(async () => {
      const result = await updateWorkerCapabilitiesAction({
        profile_id: profile.id,
        worker_type: workerType,
        can_log_expenses: canLogExpenses,
        can_invoice: canInvoice,
        default_pay_rate_dollars: payRate,
        default_charge_rate_dollars: chargeRate,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to save.');
        return;
      }
      toast.success('Worker settings saved.');
    });
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-md border bg-paper-soft p-4">
      <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Rate &amp; capability
        <span className="rounded bg-muted px-1.5 py-0.5 text-foreground/80">
          Owner / Admin · not visible to {workerName}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-12">
        <div className="space-y-1 md:col-span-3">
          <Label className="text-xs">Type</Label>
          <Select value={workerType} onValueChange={(v) => setWorkerType(v as typeof workerType)}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="subcontractor">Subcontractor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Log expenses</Label>
          <Select
            value={canLogExpenses}
            onValueChange={(v) => setCanLogExpenses(v as typeof canLogExpenses)}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Default</SelectItem>
              <SelectItem value="yes">Allow</SelectItem>
              <SelectItem value="no">Block</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Submit invoices</Label>
          <Select value={canInvoice} onValueChange={(v) => setCanInvoice(v as typeof canInvoice)}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Default</SelectItem>
              <SelectItem value="yes">Allow</SelectItem>
              <SelectItem value="no">Block</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">
            Pay <span className="font-normal text-muted-foreground">what you pay them</span>
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            className="min-h-11"
            value={payRate}
            onChange={(e) => setPayRate(e.target.value)}
            placeholder="—"
            aria-label="Pay rate — what you pay them, CAD per hour"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">
            Charge{' '}
            <span className="font-normal text-muted-foreground">what you bill the client</span>
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            className="min-h-11"
            value={chargeRate}
            onChange={(e) => setChargeRate(e.target.value)}
            placeholder="—"
            aria-label="Charge rate — what you bill the client, CAD per hour"
          />
        </div>
        <div className="flex items-end md:col-span-1">
          <Button onClick={handleSave} disabled={pending} size="sm" className="min-h-11 w-full">
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>

      {/* Labour margin — OWNER-ONLY render gate. */}
      {isOwnerViewer && marginCents !== null ? (
        <div className="flex w-max items-center gap-1.5 rounded bg-muted px-2 py-1 font-mono text-[11px] font-semibold tracking-wider text-muted-foreground">
          <span className="uppercase tracking-widest text-brand">Owner</span>
          Labour margin <Money cents={marginCents} className="text-foreground" />
          {marginPct !== null ? (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>{marginPct}%</span>
            </>
          ) : null}
          <span className="font-normal normal-case">/ hr</span>
        </div>
      ) : null}
    </div>
  );
}
