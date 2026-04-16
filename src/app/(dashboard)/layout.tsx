import type { ReactNode } from 'react';
import { Header } from '@/components/layout/header';
import { SidebarNav } from '@/components/layout/sidebar';
import { getCurrentTenant } from '@/lib/auth/helpers';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const tenant = await getCurrentTenant();
  const businessName = tenant?.name;

  return (
    <div className="flex min-h-screen w-full">
      <SidebarNav />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header businessName={businessName} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
