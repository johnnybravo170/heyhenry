'use client';

/**
 * Table showing all invite codes for the current tenant.
 * Owners can revoke active invites.
 */

import { Loader2, X } from 'lucide-react';
import { useTransition } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WorkerInviteRow } from '@/lib/db/queries/worker-invites';
import { revokeInviteAction } from '@/server/actions/team';

function inviteStatus(invite: WorkerInviteRow): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  if (invite.revoked_at) return { label: 'Revoked', variant: 'destructive' };
  if (invite.used_at) return { label: 'Used', variant: 'secondary' };
  if (new Date(invite.expires_at) < new Date()) return { label: 'Expired', variant: 'outline' };
  return { label: 'Active', variant: 'default' };
}

function RevokeButton({ inviteId }: { inviteId: string }) {
  const [pending, startTransition] = useTransition();

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeInviteAction(inviteId);
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to revoke invite.');
        return;
      }
      toast.success('Invite revoked.');
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke invite?</AlertDialogTitle>
          <AlertDialogDescription>
            This invite link will stop working. You can create a new one later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRevoke}>Revoke</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type Props = {
  invites: WorkerInviteRow[];
};

export function InvitesTable({ invites }: Props) {
  if (invites.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No invites yet. Generate one above to get started.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-[60px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invites.map((invite) => {
          const status = inviteStatus(invite);
          const isActive = status.label === 'Active';

          return (
            <TableRow key={invite.id}>
              <TableCell className="font-mono text-sm">{invite.code.slice(0, 8)}...</TableCell>
              <TableCell>
                <Badge variant={status.variant}>{status.label}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(invite.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>{isActive ? <RevokeButton inviteId={invite.id} /> : null}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
