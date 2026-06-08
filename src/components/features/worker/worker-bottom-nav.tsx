'use client';

import {
  CalendarDays,
  Camera,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  Home,
  Image as ImageIcon,
  Lock,
  type LucideIcon,
  Plus,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Field-hardened worker bottom nav (OD `od-worker-app/screens/mobile.html`).
 *
 * Headline UX fix: the old nav rendered up to 8 tabs. This consolidates to
 * **4 primary tabs** (Today · Calendar · Projects · Profile) plus a **raised
 * rust "Log" FAB** (64×64, centered, lifts above the bar). Tasks/Time/
 * Expenses/Invoices are reached from Today + the Log sheet the FAB opens.
 *
 * Targets are glove-sized: nav row 64px tall, FAB 64×64, sheet options 64px.
 * Rust is reserved for the Log action + ✦ Henry only.
 */

type PrimaryTab = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
};

const PRIMARY_TABS: PrimaryTab[] = [
  { href: '/w', label: 'Today', icon: Home, match: (p) => p === '/w' },
  {
    href: '/w/calendar',
    label: 'Calendar',
    icon: CalendarDays,
    match: (p) => p.startsWith('/w/calendar'),
  },
  {
    href: '/w/projects',
    label: 'Projects',
    icon: FolderKanban,
    match: (p) => p.startsWith('/w/projects'),
  },
  { href: '/w/profile', label: 'Profile', icon: User, match: (p) => p.startsWith('/w/profile') },
];

export function WorkerBottomNav({
  canInvoice = false,
  canLogExpenses = true,
}: {
  canInvoice?: boolean;
  canLogExpenses?: boolean;
}) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Close the sheet on route change. `pathname` is the intended trigger even
  // though the body only calls a setter — biome's heuristic flags it as extra.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on route change to dismiss the sheet
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  // Split the four primary tabs around the center FAB slot.
  const [left, right] = [PRIMARY_TABS.slice(0, 2), PRIMARY_TABS.slice(2)];

  return (
    <>
      {sheetOpen ? (
        <LogSheet
          canInvoice={canInvoice}
          canLogExpenses={canLogExpenses}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-chrome pb-[max(env(safe-area-inset-bottom),0.5rem)]"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-[1fr_1fr_5.75rem_1fr_1fr] items-stretch">
          {left.map((t) => (
            <NavTab key={t.href} tab={t} pathname={pathname ?? ''} />
          ))}

          <div className="relative">
            <button
              type="button"
              aria-label="Log"
              onClick={() => setSheetOpen(true)}
              className="-translate-x-1/2 absolute bottom-[18px] left-1/2 grid size-16 place-items-center rounded-[22px] border-4 border-background bg-brand text-white shadow-[0_8px_22px_rgba(194,65,12,0.36)] active:scale-95"
            >
              <Plus className="size-6" strokeWidth={2.5} />
            </button>
            <span className="-translate-x-1/2 pointer-events-none absolute bottom-[3px] left-1/2 bg-chrome px-1 font-semibold text-[12px] text-foreground">
              Log
            </span>
          </div>

          {right.map((t) => (
            <NavTab key={t.href} tab={t} pathname={pathname ?? ''} />
          ))}
        </div>
      </nav>
    </>
  );
}

function NavTab({ tab, pathname }: { tab: PrimaryTab; pathname: string }) {
  const active = tab.match(pathname);
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-1 px-1 pt-2',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <Icon className="size-[22px]" />
      <span className={cn('text-[12px]', active ? 'font-bold' : 'font-semibold')}>{tab.label}</span>
      {active ? <span className="size-[5px] rounded-full bg-foreground" /> : null}
    </Link>
  );
}

type SheetOption = {
  icon: LucideIcon;
  title: string;
  meta: string;
  href?: string;
  primary?: boolean;
  locked?: boolean;
};

function LogSheet({
  canInvoice,
  canLogExpenses,
  onClose,
}: {
  canInvoice: boolean;
  canLogExpenses: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const options: SheetOption[] = [
    {
      icon: Clock,
      title: 'Log time',
      meta: 'Hours · work area · notes',
      href: '/w/time/new',
      primary: true,
    },
  ];
  if (canLogExpenses) {
    options.push({
      icon: Camera,
      title: 'Snap receipt',
      meta: 'Camera opens · ✦ Henry reads it',
      href: '/w/expenses/new',
    });
  }
  options.push({
    icon: ImageIcon,
    title: 'Snap project photo',
    meta: 'Tag to project · client portal optional',
    href: '/w/projects',
  });
  options.push(
    canInvoice
      ? {
          icon: FileText,
          title: 'Build invoice',
          meta: 'From unbilled time & expenses',
          href: '/w/invoices/new',
        }
      : {
          icon: FileText,
          title: 'Build invoice',
          meta: 'Ask your supervisor to turn this on',
          locked: true,
        },
  );

  function go(href?: string) {
    if (!href) return;
    onClose();
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Dismiss"
        tabIndex={-1}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Log"
        className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-3xl bg-background px-4 pt-3 pb-[max(env(safe-area-inset-bottom),2rem)] shadow-[0_-22px_50px_rgba(10,10,10,0.22)]"
      >
        <div className="mx-auto mb-3.5 h-1 w-11 rounded-full bg-border" />
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-[16px] text-foreground tracking-tight">Log…</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Capture now — clean up later.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-[10px] text-muted-foreground"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.title}
                type="button"
                disabled={opt.locked}
                onClick={() => go(opt.href)}
                className={cn(
                  'flex min-h-16 items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 text-left',
                  opt.locked ? 'cursor-not-allowed opacity-55' : 'active:bg-muted/40',
                )}
              >
                <span
                  className={cn(
                    'grid size-11 shrink-0 place-items-center rounded-xl border',
                    opt.primary
                      ? 'border-brand bg-brand text-white'
                      : 'border-border bg-paper-soft text-foreground',
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-[14px] text-foreground tracking-tight">
                    {opt.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground uppercase tracking-wide">
                    {opt.meta}
                  </span>
                </span>
                {opt.locked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 font-mono font-bold text-[11px] text-muted-foreground uppercase tracking-wide">
                    <Lock className="size-[11px]" /> Off
                  </span>
                ) : (
                  <ChevronRight
                    className={cn('size-4', opt.primary ? 'text-brand' : 'text-muted-foreground')}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-brand/20 bg-[#FEF0E3] p-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand text-white">
            <Sparkles className="size-3.5" />
          </span>
          <p className="text-[12px] text-brand leading-snug">
            <span className="font-extrabold">✦ Henry can draft</span> a time entry from a voice memo
            or an invoice from your unbilled hours. You always confirm — Henry never submits money
            on its own.
          </p>
        </div>
      </div>
    </div>
  );
}
