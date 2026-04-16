import type { ReactNode } from 'react';
import { Header } from '@/components/layout/header';
import { SidebarNav } from '@/components/layout/sidebar';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // Task 1.6 will wire `getCurrentTenant()` here and pass its name to <Header />.
  return (
    <div className="flex min-h-screen w-full">
      <SidebarNav />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
