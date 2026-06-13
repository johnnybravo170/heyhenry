'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VerticalNavItem } from '@/lib/verticals/load-pack';
import { resolveIcon } from './nav-icon';
import { NavLink } from './nav-link';

const COLLAPSED_KEY = 'henryos:sidebar:collapsed';

function NavList({
  navItems,
  collapsed = false,
  onNavigate,
}: {
  navItems: VerticalNavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="Primary"
      className={cn('flex flex-col gap-0.5', collapsed ? 'px-2 py-2' : 'p-2')}
    >
      {navItems.map((item) => {
        const Icon = resolveIcon(item.icon);
        return (
          <div key={item.href}>
            {item.dividerBefore ? (
              <hr className={cn('my-1 border-sidebar-border/50', collapsed ? 'mx-1' : 'mx-2')} />
            ) : null}
            <NavLink
              href={item.href}
              icon={Icon}
              onNavigate={onNavigate}
              collapsed={collapsed}
              label={item.label}
              badge={item.badge}
            >
              {item.label}
            </NavLink>
          </div>
        );
      })}
    </nav>
  );
}

export function SidebarNav({ navItems }: { navItems: VerticalNavItem[] }) {
  // Hydrate collapsed state from localStorage so it persists across reloads.
  // Default = expanded; only flip to collapsed if the stored value says so.
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_KEY);
      if (stored === '1') setCollapsed(true);
    } catch {
      // localStorage may be blocked (private windows, etc) — fall through.
    }
    setHydrated(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <aside
      aria-label="Sidebar"
      data-collapsed={collapsed ? 'true' : undefined}
      className={cn(
        'hidden shrink-0 border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex md:flex-col',
        collapsed ? 'w-14' : 'w-52',
        // Avoid a flash of expanded-then-collapsed on first paint by hiding
        // until we've checked localStorage.
        !hydrated && 'invisible',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        {collapsed ? null : <span className="text-sm font-semibold">HeyHenry</span>}
        <Button
          variant="ghost"
          size="icon"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          onClick={toggle}
          className="size-8"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavList navItems={navItems} collapsed={collapsed} />
      </div>
    </aside>
  );
}

// MobileSidebarToggle (the header hamburger + drawer) was retired when the
// mobile primary nav moved to OwnerBottomNav and its "More" sheet.
