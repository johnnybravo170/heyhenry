import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type ActivationFlag,
  type FoundingMemberActivation,
  SACRED_PATH_STAGES,
  type SacredPathStage,
} from '@/lib/db/queries/founding-member-activation';
import { cn } from '@/lib/utils';

/** Short labels for the sacred-path rungs, in order. */
const STAGE_LABELS: Record<SacredPathStage, string> = {
  lead: 'Lead',
  estimate: 'Estimate',
  approval: 'Approval',
  project: 'Project',
  invoice: 'Invoice',
  payment: 'Payment',
  qbo: 'QBO',
};

// Platform-admin surface — Hey Henry staff in Vancouver. No per-tenant tz
// applies here, so we format in a fixed tz (matches TenantTable).
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

const ACTIVATION_STYLES: Record<ActivationFlag, { label: string; className: string }> = {
  green: {
    label: 'On time',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  amber: {
    label: 'At risk',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  },
  red: { label: 'Missed', className: 'bg-destructive/10 text-destructive' },
};

function ActivationBadge({ flag }: { flag: ActivationFlag }) {
  const s = ACTIVATION_STYLES[flag];
  return (
    <Badge variant="secondary" className={cn('border-transparent', s.className)}>
      {s.label}
    </Badge>
  );
}

/** Days-stalled is the headline number. Tint by severity, calmly. */
function DaysStalled({ days }: { days: number | null }) {
  if (days === null) {
    return <span className="text-muted-foreground">No movement yet</span>;
  }
  const tone =
    days >= 14
      ? 'text-destructive'
      : days >= 7
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-foreground';
  return (
    <span className={cn('font-semibold tabular-nums', tone)}>
      {days}
      <span className="text-muted-foreground ml-1 text-xs font-normal">
        {days === 1 ? 'day' : 'days'}
      </span>
    </span>
  );
}

/**
 * Sacred-path arrow strip: lead → estimate → approval → project → invoice →
 * payment → QBO. Lit rungs are filled; the current stage is ringed.
 */
function StageStrip({
  stages,
  current,
}: {
  stages: Record<SacredPathStage, boolean>;
  current: SacredPathStage;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
      {SACRED_PATH_STAGES.map((stage, i) => {
        const lit = stages[stage];
        const isCurrent = stage === current;
        return (
          <span key={stage} className="flex items-center gap-1">
            {i > 0 && (
              <span
                className={cn('text-xs', lit ? 'text-foreground/40' : 'text-muted-foreground/30')}
              >
                →
              </span>
            )}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-eyebrow leading-tight whitespace-nowrap',
                lit ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground/60',
                isCurrent && 'ring-1 ring-primary font-medium',
              )}
            >
              {STAGE_LABELS[stage]}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function ActivationTable({ members }: { members: FoundingMemberActivation[] }) {
  if (members.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No founding members yet. Set <code>tenants.founding_member = true</code> to add one.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Founding member</TableHead>
            <TableHead className="min-w-[22rem]">Sacred path</TableHead>
            <TableHead className="text-right">Days stalled</TableHead>
            <TableHead>Last activity</TableHead>
            <TableHead>Last Henry voice</TableHead>
            <TableHead>Activation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.tenant_id}>
              <TableCell className="align-top font-medium">
                <div>{m.name}</div>
                {m.vertical && (
                  <div className="text-muted-foreground text-xs capitalize">{m.vertical}</div>
                )}
              </TableCell>
              <TableCell className="align-top">
                <StageStrip stages={m.stages} current={m.current_stage} />
              </TableCell>
              <TableCell className="text-right align-top">
                <DaysStalled days={m.days_stalled} />
              </TableCell>
              <TableCell className="text-muted-foreground align-top text-sm whitespace-nowrap">
                {formatDate(m.last_movement_at)}
              </TableCell>
              <TableCell className="text-muted-foreground align-top text-sm whitespace-nowrap">
                {formatDate(m.last_henry_at)}
              </TableCell>
              <TableCell className="align-top">
                <ActivationBadge flag={m.activation} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
