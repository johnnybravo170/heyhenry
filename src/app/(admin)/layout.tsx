import type { ReactNode } from 'react';
import { AdminHeader } from '@/components/layout/admin-header';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { requirePlatformAdmin } from '@/lib/auth/helpers';

/**
 * Admin layout — gates access to the platform admin surface.
 *
 * Uses the `platform_admins` table (service-role read) rather than an
 * ADMIN_EMAIL env var so new admins can be granted access without a
 * redeploy. The proxy (src/proxy.ts) does a first-pass gate at the edge;
 * this layout is the server-side belt-and-braces.
 */

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requirePlatformAdmin();

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
      <AdminSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AdminHeader email={user.email ?? null} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
