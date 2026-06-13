'use client';

import {
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  Plus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { VerticalNavItem } from '@/lib/verticals/load-pack';
import { resolveIcon } from './nav-icon';

/**
 * Owner/contractor mobile bottom-tab shell (md:hidden).
 *
 * The desktop sidebar (`SidebarNav`) only renders at md+, so on a phone the
 * primary nav used to be just the hamburger drawer — i.e. the desktop top bar
 * reflowed. This is the mobile-first nav the OD designs specify
 * (`od-dashboard/screens/mobile.html` et al): four primary tabs + a "More"
 * sheet for the rest. Modeled on the field-proven `WorkerBottomNav`, rendered
 * in the current White Ledger skin (ink active state + dot, no rust — rust is
 * reserved for hero CTAs and ✦ Henry).
 *
 * "More" supersedes the header hamburger, so the header drops it on mobile.
 */

type PrimaryTab = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
};

const PRIMARY_TABS: PrimaryTab[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    match: (p) => p === '/dashboard',
  },
  {
    href: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    match: (p) => p.startsWith('/projects'),
  },
  { href: '/inbox', label: 'Inbox', icon: Inbox, match: (p) => p.startsWith('/inbox') },
  {
    href: '/invoices',
    label: 'Invoices',
    icon: FileText,
    match: (p) => p.startsWith('/invoices'),
  },
];

/** A nav item belongs to a primary tab's route family (so it's excluded from More). */
const isPrimaryHref = (href: string) => PRIMARY_TABS.some((t) => t.match(href));

export function OwnerBottomNav({ navItems }: { navItems: VerticalNavItem[] }) {
  const pathname = usePathname() ?? '';
  const [moreOpen, setMoreOpen] = useState(false);

  // Dismiss the More sheet on navigation. pathname is the intended trigger.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on route change to dismiss the sheet
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Inbox badge rides on whichever nav item owns the inbox route.
  const inboxBadge = navItems.find((i) => i.href.startsWith('/inbox'))?.badge;
  // Everything not promoted to a primary tab lives in the More sheet.
  const moreItems = navItems.filter((i) => !isPrimaryHref(i.href));
  const moreActive = !PRIMARY_TABS.some((t) => t.match(pathname));

  return (
    <>
      {moreOpen ? <MoreSheet items={moreItems} onClose={() => setMoreOpen(false)} /> : null}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-chrome pb-[max(env(safe-area-inset-bottom),0.5rem)] md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-stretch">
          {PRIMARY_TABS.map((t) => (
            <NavTab
              key={t.href}
              href={t.href}
              label={t.label}
              icon={t.icon}
              active={t.match(pathname)}
              badge={t.href.startsWith('/inbox') ? inboxBadge : undefined}
            />
          ))}
          <button
            type="button"
            aria-label="More"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-1 pt-2',
              moreActive ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <MoreGlyph />
            <span className={cn('text-[12px]', moreActive ? 'font-bold' : 'font-semibold')}>
              More
            </span>
            {moreActive ? <span className="size-[5px] rounded-full bg-foreground" /> : null}
          </button>
        </div>
      </nav>
    </>
  );
}

function NavTab({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1 px-1 pt-2',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <span className="relative">
        <Icon className="size-[22px]" />
        {badge ? (
          <span className="-right-2 -top-1.5 absolute grid min-w-[18px] place-items-center rounded-full bg-brand px-1 font-bold text-[11px] text-white leading-[18px]">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      <span className={cn('text-[12px]', active ? 'font-bold' : 'font-semibold')}>{label}</span>
      {active ? <span className="size-[5px] rounded-full bg-foreground" /> : null}
    </Link>
  );
}

/** Three-dot "More" glyph sized to match the 22px tab icons. */
function MoreGlyph() {
  return (
    <span className="flex h-[22px] items-center gap-[3px]" aria-hidden>
      <span className="size-[5px] rounded-full bg-current" />
      <span className="size-[5px] rounded-full bg-current" />
      <span className="size-[5px] rounded-full bg-current" />
    </span>
  );
}

function MoreSheet({ items, onClose }: { items: VerticalNavItem[]; onClose: () => void }) {
  const pathname = usePathname() ?? '';
  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <button
        type="button"
        aria-label="Dismiss"
        tabIndex={-1}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="More"
        className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-3xl bg-background px-4 pt-3 pb-[max(env(safe-area-inset-bottom),2rem)] shadow-[0_-22px_50px_rgba(10,10,10,0.22)]"
      >
        <div className="mx-auto mb-3.5 h-1 w-11 rounded-full bg-border" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-[16px] text-foreground tracking-tight">More</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-[10px] text-muted-foreground"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        {/* The one rust CTA on this sheet — primary create action, replacing
            the New Project button retired from the mobile header. */}
        <Link
          href="/projects/new"
          onClick={onClose}
          className="mb-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand px-4 font-semibold text-[14px] text-white"
        >
          <Plus className="size-[18px]" />
          New project
        </Link>
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => {
            const Icon = resolveIcon(item.icon);
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left active:bg-muted/40',
                  active && 'border-foreground/30',
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-paper-soft text-foreground">
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[14px] text-foreground leading-tight">
                    {item.label}
                  </span>
                  {item.badge ? (
                    <span className="text-[12px] text-muted-foreground">{item.badge} pending</span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
