'use client';

/**
 * Mobile (<sm) replacement for the settings sidebar.
 *
 * A grouped-card list (the OD render's pattern), NOT a native <select>:
 * settings is 27 destinations across 6 groups, and a 27-option dropdown is
 * a thumb-hostile wall. Each group renders as a card of tappable rows
 * (icon · title · chevron) that route on tap, with ≥44px hit targets.
 *
 * On a subpage the full 27-item menu is COLLAPSED behind a section selector
 * (current section + chevron) so the page's own content is immediately
 * visible — tapping the selector reveals the grouped list (OD's mobile
 * section-switcher pattern). Closes again on navigation.
 *
 * Reads from the same `getSettingsNav` filter as the desktop sidebar, so
 * role + vertical gating stays in lockstep across breakpoints. The active
 * row is filled (`bg-foreground`) to match the desktop active state.
 */

import { ChevronDown, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { SettingsNavFoot } from './settings-nav-foot';
import {
  GRADUATE_HREFS,
  getSettingsNav,
  getSettingsNavCounts,
  isSettingsItemActive,
  type SettingsRole,
} from './settings-nav-items';

export function SettingsMobileNav({
  vertical,
  role,
}: {
  vertical: string | null;
  role: SettingsRole;
}) {
  const pathname = usePathname() ?? '';
  // See sidebar for the rationale — derive filtered groups on the client
  // from the primitives so we don't try to serialize icon refs.
  const groups = useMemo(() => getSettingsNav({ vertical, role }), [vertical, role]);
  const counts = useMemo(() => getSettingsNavCounts({ vertical, role }), [vertical, role]);

  // Current section title for the collapsed selector.
  const currentTitle = useMemo(() => {
    for (const group of groups) {
      const hit = group.items.find((item) => isSettingsItemActive(pathname, item));
      if (hit) return hit.title;
    }
    return 'Settings';
  }, [groups, pathname]);

  const [open, setOpen] = useState(false);
  // Collapse again after navigating to a new section.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on route change to close the selector
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <nav aria-label="Settings navigation" className="mb-4 sm:hidden">
      {/* Collapsed selector — shows the current section; expands the full menu. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex w-full items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-left"
      >
        <SettingsIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-semibold text-foreground text-sm">
          {currentTitle}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-1.5 px-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {group.label}
              </div>
              <ul className="overflow-hidden rounded-xl border bg-card">
                {group.items.map((item) => {
                  const active = isSettingsItemActive(pathname, item);
                  const Icon = item.icon;
                  const graduates = GRADUATE_HREFS.has(item.href);
                  return (
                    <li key={item.href} className="border-b last:border-b-0">
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center gap-3 px-3 py-2.5 text-sm transition-colors',
                          active
                            ? 'bg-foreground font-semibold text-background'
                            : 'hover:bg-accent',
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        <ChevronRight
                          aria-hidden
                          className={cn(
                            'size-4 shrink-0',
                            active ? 'text-background/60' : 'text-muted-foreground/50',
                          )}
                        />
                        {graduates ? <span className="sr-only">(opens its own page)</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <SettingsNavFoot counts={counts} />
        </div>
      ) : null}
    </nav>
  );
}
