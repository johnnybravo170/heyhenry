'use client';

/**
 * Remove team member button with AlertDialog confirmation.
 * Disabled for the owner role.
 */

import { Loader2, Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { removeTeamMemberAction } from '@/server/actions/team';

type Props = {
  memberId: string;
  memberEmail: string;
  isOwner: boolean;
};

export function RemoveMemberButton({ memberId, memberEmail, isOwner }: Props) {
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      const result = await removeTeamMemberAction(memberId);
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to remove member.');
        return;
      }
      toast.success(`${memberEmail} has been removed from the team.`);
    });
  }

  if (isOwner) {
    return (
      <Button variant="ghost" size="icon" disabled title="Owner cannot be removed">
        <Trash2 className="size-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove team member?</AlertDialogTitle>
          <AlertDialogDescription>
            {memberEmail} will lose access to your account. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
