'use client';

/**
 * Mobile (<sm) replacement for the settings sidebar.
 *
 * A grouped-card list (the OD render's pattern), NOT a native <select>:
 * settings is 27 destinations across 6 groups, and a 27-option dropdown is
 * a thumb-hostile wall. Each group renders as a card of tappable rows
 * (icon · title · chevron) that route on tap, with ≥44px hit targets.
 *
 * Reads from the same `getSettingsNav` filter as the desktop sidebar, so
 * role + vertical gating stays in lockstep across breakpoints. The active
 * row is filled (`bg-foreground`) to match the desktop active state.
 */

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
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

  return (
    <nav aria-label="Settings navigation" className="mb-4 space-y-4 sm:hidden">
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
                      active ? 'bg-foreground font-semibold text-background' : 'hover:bg-accent',
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
    </nav>
  );
}
