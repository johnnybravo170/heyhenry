'use client';

/**
 * Pending invites — folds beneath the roster as a secondary "Pending (n)"
 * disclosure, not its own equal-weight card (gap 1). Empty → renders nothing.
 *
 * Surfaces the existing-but-previously-hidden actions: Copy link · Resend
 * (`sendWorkerInviteEmailAction`) · Revoke (`revokeInviteAction`) · Delete
 * (`deleteInviteAction`, Used-protected). No new mutations; the join URL is
 * reconstructed client-side from the current origin + invite code.
 */

import { ChevronRight, Copy, Loader2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { useState, useTransition } from 'react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import type { WorkerInviteRow } from '@/lib/db/queries/worker-invites';
import { type StatusTone, statusToneClass, statusToneIcon } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import {
  deleteInviteAction,
  revokeInviteAction,
  sendWorkerInviteEmailAction,
} from '@/server/actions/team';

type InviteState = { label: string; tone: StatusTone };

/** Map an invite to its lifecycle status (Active / Expired / Used / Revoked). */
function inviteState(invite: WorkerInviteRow): InviteState {
  if (invite.revoked_at) return { label: 'Revoked', tone: 'danger' };
  if (invite.used_at) return { label: 'Used', tone: 'neutral' };
  if (new Date(invite.expires_at) < new Date()) return { label: 'Expired', tone: 'warning' };
  return { label: 'Active', tone: 'success' };
}

function joinUrlFor(code: string): string {
  if (typeof window === 'undefined') return `/join/${code}`;
  return `${window.location.origin}/join/${code}`;
}

function InviteRow({ invite }: { invite: WorkerInviteRow }) {
  const tz = useTenantTimezone();
  const [pending, startTransition] = useTransition();
  const state = inviteState(invite);
  const ToneIcon = statusToneIcon[state.tone];
  const canDelete = state.label !== 'Used';
  const canResend = state.label === 'Active' && !!invite.invited_email;

  async function copyLink() {
    await navigator.clipboard.writeText(joinUrlFor(invite.code));
    toast.success('Link copied.');
  }

  function resend() {
    const email = invite.invited_email;
    if (!email) return;
    startTransition(async () => {
      const result = await sendWorkerInviteEmailAction(email, joinUrlFor(invite.code));
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to resend invite.');
        return;
      }
      toast.success('Invite resent.');
    });
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeInviteAction(invite.id);
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to revoke invite.');
        return;
      }
      toast.success('Invite revoked.');
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteInviteAction(invite.id);
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to delete invite.');
        return;
      }
      toast.success('Invite deleted.');
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3 sm:grid sm:grid-cols-[1.8fr_0.9fr_1fr_1.2fr] sm:items-center sm:gap-3.5">
      <div className="flex min-w-0 flex-col">
        {invite.invited_name ? (
          <span className="text-sm font-semibold text-foreground">{invite.invited_name}</span>
        ) : null}
        {invite.invited_email ? (
          <span className="truncate text-xs text-muted-foreground">{invite.invited_email}</span>
        ) : !invite.invited_name ? (
          <span className="w-max rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {invite.code.slice(0, 8)}…
          </span>
        ) : null}
      </div>
      <div>
        <Badge variant="outline" className={cn('gap-1', statusToneClass[state.tone])}>
          <ToneIcon className="size-3" aria-hidden />
          {state.label}
        </Badge>
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {new Intl.DateTimeFormat(undefined, { timeZone: tz }).format(new Date(invite.created_at))}
      </span>
      <div className="flex flex-wrap justify-start gap-1.5 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="min-h-9"
          onClick={copyLink}
          title={!invite.invited_email ? 'Copy link to share — this is how you resend' : undefined}
        >
          <Copy className="size-3.5" />
          {invite.invited_email ? 'Copy link' : 'Copy invite link'}
        </Button>
        {canResend ? (
          <Button
            variant="outline"
            size="sm"
            className="min-h-9"
            onClick={resend}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Resend
          </Button>
        ) : null}
        {state.label === 'Active' ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={revoke}
            disabled={pending}
            title="Revoke invite"
          >
            <XCircle className="size-4 text-muted-foreground" />
          </Button>
        ) : null}
        {canDelete ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                disabled={pending}
                title="Delete invite"
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this invite?</AlertDialogTitle>
                <AlertDialogDescription>
                  The link will stop working immediately and disappear from this list. You can
                  always create a fresh one.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Delete invite</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  );
}

export function PendingInvites({ invites }: { invites: WorkerInviteRow[] }) {
  const [open, setOpen] = useState(true);
  // Fold away entirely when there's nothing pending (no empty table).
  if (invites.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t">
      <CollapsibleTrigger className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-nav-active/40">
        <ChevronRight
          className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
        <span className="text-sm font-semibold text-foreground">Pending invites</span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
          {invites.length}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          Links expire 7 days after sending.
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {invites.map((invite) => (
          <InviteRow key={invite.id} invite={invite} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
