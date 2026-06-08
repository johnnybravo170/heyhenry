import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/date/format';
import { type StatusTone, statusToneClass, statusToneIcon } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';

type ReferralEntry = {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
};

/**
 * Referral lifecycle → status-tokens. Only `pending`→`signed_up` is wired
 * today; `converted`/`churned` map here so the row renders correctly the day
 * the payout pipeline lands, but nothing in the app sets them yet.
 *   pending    → info    "Sent"        (in-flight, awaiting external)
 *   signed_up  → success "Signed up"   (the real, wired win)
 *   converted  → success "Converted"   (target — not wired)
 *   churned    → neutral "Churned"     (target — not wired)
 */
const REFERRAL_TONE: Record<string, { tone: StatusTone; label: string }> = {
  pending: { tone: 'info', label: 'Sent' },
  signed_up: { tone: 'success', label: 'Signed up' },
  converted: { tone: 'success', label: 'Converted' },
  churned: { tone: 'neutral', label: 'Churned' },
};

const PILL =
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold';

function ReferralStatusPill({ status }: { status: string }) {
  const entry = REFERRAL_TONE[status] ?? { tone: 'neutral' as StatusTone, label: status };
  const Icon = statusToneIcon[entry.tone];
  return (
    <span className={cn(PILL, statusToneClass[entry.tone])}>
      <Icon className="size-3" aria-hidden="true" />
      {entry.label}
    </span>
  );
}

function contactLabel(r: ReferralEntry): { text: string; isLink: boolean } {
  const text = r.email ?? r.phone ?? 'Link signup';
  return { text, isLink: !r.email && !r.phone };
}

export function ReferralHistory({
  referrals,
  timezone,
}: {
  referrals: ReferralEntry[];
  timezone: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b p-4">
        <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Activity
        </p>
        <h3 className="text-base font-bold leading-tight tracking-tight text-foreground">
          Referral history
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Who you&apos;ve invited, and where they&apos;re at. Dates in your time zone.
        </p>
      </div>

      {referrals.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No referrals yet. Share your link or send an invite to get started.
        </p>
      ) : (
        <>
          {/* Desktop: table */}
          <table className="hidden w-full border-collapse text-sm sm:table">
            <thead>
              <tr>
                <th className="border-b bg-muted/40 px-4 py-2.5 text-left font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Contact
                </th>
                <th className="border-b bg-muted/40 px-4 py-2.5 text-left font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="border-b bg-muted/40 px-4 py-2.5 text-right font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => {
                const contact = contactLabel(r);
                return (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td
                      className={cn(
                        'px-4 py-3 align-middle',
                        contact.isLink
                          ? 'text-sm italic text-muted-foreground'
                          : 'font-mono text-xs font-semibold text-foreground',
                      )}
                    >
                      {contact.text}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <ReferralStatusPill status={r.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right align-middle text-sm tabular-nums text-muted-foreground">
                      {formatDate(r.created_at, { timezone })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile: stacked cards (PATTERNS §18) */}
          <ul className="divide-y sm:hidden">
            {referrals.map((r) => {
              const contact = contactLabel(r);
              return (
                <li key={r.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'truncate',
                        contact.isLink
                          ? 'text-sm italic text-muted-foreground'
                          : 'font-mono text-xs font-semibold text-foreground',
                      )}
                    >
                      {contact.text}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {formatDate(r.created_at, { timezone })}
                    </p>
                  </div>
                  <ReferralStatusPill status={r.status} />
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
            <span>Status updates as referees move through signup.</span>
            <span>You only see your own referrals.</span>
          </div>
        </>
      )}
    </Card>
  );
}
