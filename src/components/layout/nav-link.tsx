'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type NavLinkProps = {
  href: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  onNavigate?: () => void;
  className?: string;
  /** When true, the label is hidden and tooltip-only — used by the collapsed sidebar. */
  collapsed?: boolean;
  /** Plain-text version of the label, used as the title attribute when collapsed. */
  label?: string;
  /** Live count badge (e.g. pending Inbox items). Calm/muted styling — not a loud alert dot. */
  badge?: number;
};

export function NavLink({
  href,
  icon: Icon,
  children,
  onNavigate,
  className,
  collapsed = false,
  label,
  badge,
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive ? 'true' : undefined}
      title={collapsed ? (label ?? undefined) : undefined}
      className={cn(
        'flex items-center rounded-md text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
        collapsed ? 'justify-center px-2 py-1.5' : 'gap-2.5 px-3 py-1.5',
        isActive && 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground',
        className,
      )}
    >
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
      {collapsed ? null : (
        <>
          <span className="flex-1">{children}</span>
          {badge && badge > 0 ? (
            <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-eyebrow font-medium leading-none text-muted-foreground tabular-nums">
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
}
