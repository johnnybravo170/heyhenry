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
};

export function NavLink({ href, icon: Icon, children, onNavigate, className }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive ? 'true' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        isActive && 'bg-muted text-foreground',
        className,
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      <span>{children}</span>
    </Link>
  );
}
