'use client';

import { AlertTriangle, Mail, Phone, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import type { MoneyAtRiskRow } from '@/lib/db/queries/money-at-risk';
import { clearMoneyAtRiskAction } from '@/server/actions/automations';

/** Mono eyebrow — small uppercase label used on stat cells across the Paper surfaces. */
const EYEBROW = 'font-mono text-[11px] uppercase tracking-wide text-muted-foreground';

export function MoneyAtRiskCard({ rows }: { rows: MoneyAtRiskRow[] }) {
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) return null;

  const totalAtRisk = rows.reduce((s, r) => s + (r.totalCents ?? 0), 0);

  const onClear = (contactId: string, name: string) => {
    startTransition(async () => {
      const res = await clearMoneyAtRiskAction({ contactId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Cleared — ${name} won't show here again.`);
    });
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-brand" aria-hidden />
          <div>
            <h2 className="text-base font-semibold">Money at risk</h2>
            <p className="inline-flex items-center gap-1.5 rounded-md bg-[#FEF0E3] px-2 py-0.5 text-xs text-foreground">
              <Sparkles className="size-3 text-brand" aria-hidden />
              <span>
                Customers who didn't respond to the auto follow-ups. They need a personal touch.
              </span>
            </p>
          </div>
        </div>
        {totalAtRisk > 0 ? (
          <div className="text-right">
            <p className={EYEBROW}>At risk</p>
            <p className="text-lg font-semibold text-brand">
              <Money cents={totalAtRisk} />
            </p>
          </div>
        ) : null}
      </div>

      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {rows.map((r) => (
          <li key={r.contactId} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                {r.customerId ? (
                  <Link href={`/contacts/${r.customerId}`} className="truncate hover:underline">
                    {r.contactName}
                  </Link>
                ) : (
                  <span className="truncate">{r.contactName}</span>
                )}
                {r.projectName ? (
                  <>
                    <span className="text-muted-foreground font-normal">·</span>
                    {r.projectId ? (
                      <Link
                        href={`/projects/${r.projectId}`}
                        className="truncate text-muted-foreground font-normal hover:underline"
                      >
                        {r.projectName}
                      </Link>
                    ) : (
                      <span className="truncate text-muted-foreground font-normal">
                        {r.projectName}
                      </span>
                    )}
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {r.totalCents !== null ? (
                  <span>
                    <Money cents={r.totalCents} />
                  </span>
                ) : null}
                <span>flagged {r.daysSinceTagged}d ago</span>
                {r.contactPhone ? (
                  <a
                    href={`tel:${r.contactPhone}`}
                    className="inline-flex min-w-0 items-center gap-1 break-all hover:text-foreground"
                  >
                    <Phone className="size-3 shrink-0" aria-hidden />
                    {r.contactPhone}
                  </a>
                ) : null}
                {r.contactEmail ? (
                  <a
                    href={`mailto:${r.contactEmail}`}
                    className="inline-flex min-w-0 items-center gap-1 break-all hover:text-foreground"
                  >
                    <Mail className="size-3 shrink-0" aria-hidden />
                    {r.contactEmail}
                  </a>
                ) : null}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onClear(r.contactId, r.contactName)}
            >
              I called them
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
