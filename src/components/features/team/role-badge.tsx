'use client';

/**
 * Role pill for the Team roster + the Add-to-crew dialog.
 *
 * Role/worker-type is NOT status — it draws from a calm, fixed palette of
 * status-token tones (never rust; rust is reserved for the Add-to-crew CTA
 * + ✦ Henry). Label + glyph, never colour-only (WCAG 2.2 AA, SC 1.4.1).
 *
 * The badge is read-only today: there is no role-mutation action (DEFERRED —
 * `updateMemberRoleAction` + `tenant_members` UPDATE RLS need Ops + a
 * migration). We render the role but never call a mutation on click.
 */

import type { LucideIcon } from 'lucide-react';
import { Briefcase, Database, HardHat, KeyRound, Shield, User } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The visual "role" a roster row presents — workers split by worker_type. */
export type DisplayRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'employee'
  | 'subcontractor'
  | 'bookkeeper';

const ROLE_META: Record<DisplayRole, { label: string; icon: LucideIcon; className: string }> = {
  // Owner: neutral paper chip — the account holder, not a status.
  owner: {
    label: 'Owner',
    icon: KeyRound,
    className: 'bg-nav-active text-foreground border-rule',
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  member: {
    label: 'Member',
    icon: User,
    className: 'bg-muted text-muted-foreground border-border',
  },
  employee: {
    label: 'Employee',
    icon: Briefcase,
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  subcontractor: {
    label: 'Subcontractor',
    icon: HardHat,
    className: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
  bookkeeper: {
    label: 'Bookkeeper',
    icon: Database,
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
};

/** Map a tenant_members.role (+ optional worker_type) to its display role. */
export function displayRoleFor(
  role: string,
  workerType?: 'employee' | 'subcontractor' | null,
): DisplayRole {
  if (role === 'worker') return workerType === 'subcontractor' ? 'subcontractor' : 'employee';
  if (role === 'owner' || role === 'admin' || role === 'member' || role === 'bookkeeper') {
    return role;
  }
  return 'member';
}

export function RoleBadge({
  role,
  className,
  title,
}: {
  role: DisplayRole;
  className?: string;
  title?: string;
}) {
  const meta = ROLE_META[role];
  const Icon = meta.icon;
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-6 w-max items-center gap-1.5 rounded-md border px-2 text-xs font-semibold leading-none',
        meta.className,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  );
}
