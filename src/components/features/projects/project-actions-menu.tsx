'use client';

/**
 * Project ⋯ overflow — the actions menu in the project header.
 *
 * Consolidates Duplicate + Delete behind a single labeled overflow,
 * replacing the old dangling, label-less trash icon (a11y + accident
 * risk) and the floating clone icon. `⋯` = actions; the `▾` next to the
 * name (ProjectDetailsCard) = attributes.
 *
 * Versions stays as its own labeled control beside this menu — it already
 * carries a clear label and its own snapshot viewer.
 */

import { Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CustomerOption } from '@/components/features/customers/customer-picker-with-create';
import { CloneProjectDialog } from '@/components/features/projects/clone-project-dialog';
import { DeleteProjectButton } from '@/components/features/projects/delete-project-button';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ProjectActionsMenu({
  projectId,
  projectName,
  defaultContactId,
  contacts,
}: {
  projectId: string;
  projectName: string;
  defaultContactId: string | null;
  contacts: CustomerOption[];
}) {
  const [cloneOpen, setCloneOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Project actions"
            className="size-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setCloneOpen(true)}>
            <Copy className="size-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CloneProjectDialog
        projectId={projectId}
        projectName={projectName}
        defaultContactId={defaultContactId}
        contacts={contacts}
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        hideTrigger
      />
      <DeleteProjectButton
        projectId={projectId}
        projectName={projectName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        hideTrigger
      />
    </>
  );
}
