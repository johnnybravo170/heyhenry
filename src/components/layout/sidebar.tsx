'use client';

import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getNavItems } from '@/lib/constants/nav';
import { cn } from '@/lib/utils';
import { NavLink } from './nav-link';

const COLLAPSED_KEY = 'henryos:sidebar:collapsed';

function NavList({
  vertical,
  collapsed = false,
  onNavigate,
}: {
  vertical: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const items = getNavItems(vertical);
  return (
    <nav
      aria-label="Primary"
      className={cn('flex flex-col gap-1', collapsed ? 'px-2 py-3' : 'p-3')}
    >
      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          icon={item.icon}
          onNavigate={onNavigate}
          collapsed={collapsed}
          label={item.label}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function SidebarNav({ vertical = 'pressure_washing' }: { vertical?: string }) {
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
        'hidden shrink-0 border-r bg-background transition-[width] duration-200 md:flex md:flex-col',
        collapsed ? 'w-14' : 'w-64',
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
        <NavList vertical={vertical} collapsed={collapsed} />
      </div>
    </aside>
  );
}

export function MobileSidebarToggle({ vertical = 'pressure_washing' }: { vertical?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Menu className="size-5" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute inset-y-0 left-0 w-64 border-r bg-background shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-sm font-semibold">HeyHenry</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="overflow-y-auto">
              <NavList vertical={vertical} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
