'use client';

/**
 * The crew roster (Region A). One row per tenant member:
 *
 *   Person · Role badge · "What they do" summary · Joined · ⋯
 *
 * Worker rows expand (chevron) into the gated rate/capability editor —
 * collapsed by default (gap 2). Role badge is read-only: there is no
 * role-mutation action (DEFERRED). The ⋯ menu carries a disabled
 * "Change role" (coming soon) and the existing hard-delete Remove confirm.
 *
 * Henry roster-gap chips (subcontractor missing GST #, worker with no pay
 * rate) render inline + read-only — labelled signals, never auto-edits.
 */

import {
  AlertTriangle,
  ChevronDown,
  Contact,
  Loader2,
  Lock,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { Fragment, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import type { TeamMemberRow } from '@/lib/db/queries/team';
import type { WorkerProfileRow } from '@/lib/db/queries/worker-profiles';
import { cn } from '@/lib/utils';
import { removeGcManagedWorkerAction, removeTeamMemberAction } from '@/server/actions/team';
import { displayRoleFor, RoleBadge } from './role-badge';
import { WorkerSettingsRow } from './worker-settings-row';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** First name for the "not visible to {name}" gate; falls back to email local-part. */
function firstNameFor(member: TeamMemberRow): string {
  const dn = member.worker_profile?.display_name;
  if (dn) return dn.trim().split(/\s+/)[0];
  return member.email.split('@')[0];
}

/** Tri-state capability label: null inherits the tenant default. */
function capLabel(value: boolean | null, verb: string): { text: string; on: boolean } {
  if (value === false) return { text: verb, on: false };
  return { text: verb, on: true }; // true OR inherit-default-on read as "can"
}

function MemberMenu({ member, onExpand }: { member: TeamMemberRow; onExpand?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isOwner = member.role === 'owner';
  const isWorker = member.role === 'worker' && member.worker_profile;

  function handleRemove() {
    startTransition(async () => {
      const result = await removeTeamMemberAction(member.id);
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to remove member.');
        return;
      }
      toast.success(`${member.email} was removed from the crew.`);
    });
  }

  if (isOwner) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        disabled
        title="The account owner can't be removed or changed here"
        aria-disabled
      >
        <MoreHorizontal className="size-4 text-muted-foreground/60" />
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            disabled={pending}
            title="Member options"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4 text-muted-foreground" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {isWorker && onExpand ? (
            <>
              <DropdownMenuItem onSelect={onExpand}>
                <ChevronDown className="size-3.5" />
                Edit rates &amp; capabilities
              </DropdownMenuItem>
              {member.worker_profile?.contact_id ? (
                <DropdownMenuItem asChild>
                  <Link href={`/contacts/${member.worker_profile.contact_id}`}>
                    <Contact className="size-3.5" />
                    View contact card
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
            </>
          ) : null}
          {/* DEFERRED — role mutation needs updateMemberRoleAction + RLS. */}
          <DropdownMenuItem disabled className="flex-col items-start gap-0.5">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-3.5" />
              Change role
            </span>
            <span className="pl-[22px] text-[11px] text-muted-foreground">Coming soon</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Trash2 className="size-3.5" />
            Remove from crew
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {member.email} from the crew?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll immediately lose access to your account, and their login is permanently
              deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CapabilitySummary({ member }: { member: TeamMemberRow }) {
  const wp = member.worker_profile;
  if (member.role === 'owner') {
    return (
      <span className="text-xs text-muted-foreground">Account owner · billing &amp; security</span>
    );
  }
  if (member.role === 'admin') {
    return (
      <span className="text-xs text-muted-foreground">Everything operational · no billing</span>
    );
  }
  if (member.role === 'bookkeeper') {
    return (
      <span className="text-xs text-muted-foreground">Expenses, bills, GST/HST, year-end</span>
    );
  }
  if (member.role === 'member') {
    return <span className="text-xs text-muted-foreground">Reads &amp; light edits</span>;
  }
  if (!wp) return <span className="text-xs text-muted-foreground">—</span>;

  const isSub = wp.worker_type === 'subcontractor';
  const expenses = capLabel(wp.can_log_expenses, 'Logs expenses');
  const invoices = capLabel(wp.can_invoice, 'Submits invoices');
  // For a sub, surface the GST flag instead of the second cap (it's the
  // year-end signal that matters). For employees, show both capabilities.
  const gstMissing = isSub && !wp.gst_number;

  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn(expenses.on ? 'text-foreground/80' : 'line-through')}>
        {expenses.text}
      </span>
      <span className="text-muted-foreground/50">·</span>
      {isSub && gstMissing ? (
        // Henry roster-gap chip — read-only signal (subcontractor missing GST #).
        <span
          className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-800"
          title="Missing GST # — needed for year-end T5018"
        >
          <AlertTriangle className="size-3" aria-hidden />
          GST # missing
        </span>
      ) : (
        <span className={cn(invoices.on ? 'text-foreground/80' : 'line-through')}>
          {invoices.text}
        </span>
      )}
    </span>
  );
}

function MemberRow({ member, isOwnerViewer }: { member: TeamMemberRow; isOwnerViewer: boolean }) {
  const tz = useTenantTimezone();
  const [expanded, setExpanded] = useState(false);
  const isOwner = member.role === 'owner';
  const isWorker = member.role === 'worker' && member.worker_profile;
  const displayName = member.worker_profile?.display_name ?? member.email;
  const showEmailSub = !!member.worker_profile?.display_name;

  return (
    <Fragment>
      <div
        className={cn(
          'flex flex-col gap-3 border-b px-4 py-3.5 last:border-b-0 sm:grid sm:grid-cols-[1.8fr_0.9fr_1.3fr_0.7fr_80px] sm:items-center sm:gap-3.5',
          isOwner && 'bg-nav-active/15',
        )}
      >
        {/* Person */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold',
              isOwner ? 'bg-foreground text-white' : 'bg-muted text-foreground/80',
            )}
          >
            {initials(displayName)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
              {displayName}
              {isOwner ? (
                <Lock
                  className="size-3 text-muted-foreground"
                  aria-label="The account owner can't be changed here"
                />
              ) : null}
            </span>
            {showEmailSub ? (
              <span className="truncate text-xs text-muted-foreground">{member.email}</span>
            ) : null}
          </span>
        </div>

        {/* Role (read-only badge — DEFERRED mutation) */}
        <div>
          <RoleBadge
            role={displayRoleFor(member.role, member.worker_profile?.worker_type)}
            title={isOwner ? "The account owner can't be changed here" : undefined}
          />
        </div>

        {/* What they do */}
        <div className="min-w-0">
          <CapabilitySummary member={member} />
        </div>

        {/* Joined */}
        <span className="text-xs tabular-nums text-muted-foreground">
          {new Intl.DateTimeFormat(undefined, { timeZone: tz }).format(new Date(member.created_at))}
        </span>

        {/* Actions */}
        <div className="flex items-center justify-end gap-0.5">
          {isWorker ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              title={expanded ? 'Close settings' : 'Edit rates & capabilities'}
            >
              <ChevronDown
                className={cn('size-4 transition-transform', expanded && 'rotate-180')}
              />
            </Button>
          ) : null}
          <MemberMenu
            member={member}
            onExpand={isWorker ? () => setExpanded((v) => !v) : undefined}
          />
        </div>
      </div>

      {isWorker && expanded && member.worker_profile ? (
        <div className="border-b bg-paper-soft px-4 py-4">
          <WorkerSettingsRow
            profile={member.worker_profile}
            workerName={firstNameFor(member)}
            isOwnerViewer={isOwnerViewer}
          />
        </div>
      ) : null}
    </Fragment>
  );
}

function GcWorkerMenu({ worker }: { worker: WorkerProfileRow }) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const workerLabel =
    worker.gc_managed_name ?? worker.display_name ?? worker.business_name ?? 'this worker';

  function handleRemove() {
    startTransition(async () => {
      const result = await removeGcManagedWorkerAction(worker.id);
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to remove worker.');
        return;
      }
      toast.success(`${workerLabel} removed from the crew.`);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            disabled={pending}
            title="Worker options"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4 text-muted-foreground" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Trash2 className="size-3.5" />
            Remove from crew
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {workerLabel} from the crew?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll be removed from all pickers and can no longer be assigned to jobs. Time
              entries they're on are kept. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function GcManagedWorkerRow({ worker }: { worker: WorkerProfileRow }) {
  const displayName =
    worker.gc_managed_name ?? worker.display_name ?? worker.business_name ?? 'Unknown';
  const isSub = worker.worker_type === 'subcontractor';

  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3.5 last:border-b-0 sm:grid sm:grid-cols-[1.8fr_0.9fr_1.3fr_0.7fr_80px] sm:items-center sm:gap-3.5">
      {/* Person */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-foreground/80">
          {initials(displayName)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
          <span className="flex items-center gap-1 text-eyebrow text-muted-foreground">
            <UserX className="size-3" aria-hidden />
            No app account
          </span>
        </span>
      </div>

      {/* Role */}
      <div>
        <RoleBadge role={isSub ? 'subcontractor' : 'employee'} />
      </div>

      {/* What they do */}
      <div className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              worker.can_log_expenses !== false ? 'text-foreground/80' : 'line-through',
            )}
          >
            Logs expenses
          </span>
          <span className="text-muted-foreground/50">·</span>
          {isSub && !worker.gst_number ? (
            <span
              className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 font-mono text-eyebrow font-semibold text-amber-800"
              title="Missing GST # — needed for year-end T5018"
            >
              <AlertTriangle className="size-3" aria-hidden />
              GST # missing
            </span>
          ) : (
            <span
              className={cn(worker.can_invoice !== false ? 'text-foreground/80' : 'line-through')}
            >
              Submits invoices
            </span>
          )}
        </span>
      </div>

      {/* No join date — GC-managed */}
      <span className="font-mono text-eyebrow text-muted-foreground/60">GC-managed</span>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5">
        <GcWorkerMenu worker={worker} />
      </div>
    </div>
  );
}

export function TeamMembersTable({
  members,
  gcWorkers,
  isOwnerViewer,
}: {
  members: TeamMemberRow[];
  gcWorkers: WorkerProfileRow[];
  /** Owner sees the Labour-margin read inside the worker editor. */
  isOwnerViewer: boolean;
}) {
  const hasAny = members.length > 0 || gcWorkers.length > 0;
  if (!hasAny) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">No crew yet.</p>;
  }

  return (
    <div>
      {/* Column header — desktop only; rows are self-labelling on mobile. */}
      <div className="hidden grid-cols-[1.8fr_0.9fr_1.3fr_0.7fr_80px] gap-3.5 border-b bg-paper px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
        <div>Person</div>
        <div>Role</div>
        <div>What they do</div>
        <div>Joined</div>
        <div />
      </div>
      {members.map((member) => (
        <MemberRow key={member.id} member={member} isOwnerViewer={isOwnerViewer} />
      ))}
      {gcWorkers.map((worker) => (
        <GcManagedWorkerRow key={worker.id} worker={worker} />
      ))}
    </div>
  );
}
