'use client';

/**
 * Table showing all team members with role badges and remove buttons.
 */

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TeamMemberRow } from '@/lib/db/queries/team';
import { RemoveMemberButton } from './remove-member-button';

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
  worker: 'outline',
};

type Props = {
  members: TeamMemberRow[];
};

export function TeamMembersTable({ members }: Props) {
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No team members found.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead className="w-[60px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="text-sm">{member.email}</TableCell>
            <TableCell>
              <Badge variant={roleBadgeVariant[member.role] ?? 'outline'}>{member.role}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(member.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <RemoveMemberButton
                memberId={member.id}
                memberEmail={member.email}
                isOwner={member.role === 'owner'}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
