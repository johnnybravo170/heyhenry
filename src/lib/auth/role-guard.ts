/**
 * Role guard for server components and actions.
 *
 * Redirects to /dashboard if the current user's role is not in the
 * allowed list. Use in server components that should only be visible
 * to owners or admins.
 */

import { redirect } from 'next/navigation';
import type { CurrentTenant } from './helpers';

export function requireRole(tenant: CurrentTenant, allowedRoles: string[]): void {
  if (!allowedRoles.includes(tenant.member.role)) {
    redirect('/dashboard');
  }
}
