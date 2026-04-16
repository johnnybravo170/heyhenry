import {
  ClipboardList,
  FileText,
  Inbox,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
} from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/jobs', label: 'Jobs', icon: ClipboardList },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
