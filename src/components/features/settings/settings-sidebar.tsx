'use client';

/**
 * Persistent left nav for `/settings/*`. Stays mounted across navigations
 * via the shared layout — only the right pane re-renders.
 *
 * Nested orphan routes (e.g. /settings/qbo-history) light up their parent
 * via the startsWith match in `isSettingsItemActive`, so the sidebar
 * never shows "nothing selected."
 *
 * Hidden under sm: viewport — `SettingsMobileNav` (a grouped-card list)
 * takes over on small screens.
 *
 * Paper restyle: mono uppercase group labels, active = filled
 * `bg-foreground`, a graduate "↗" glyph on heavy sub-flows that link out
 * to their own surfaces, and an honest foot count derived from the same
 * filter the list uses.
 */

import { ArrowUpRight } from 'lucide-react';
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

export function SettingsSidebar({
  vertical,
  role,
}: {
  vertical: string | null;
  role: SettingsRole;
}) {
  const pathname = usePathname() ?? '';
  // Run the filter client-side. Icon components can't cross the
  // server→client boundary as serialized props (they're function refs),
  // so we hand the client primitives (vertical + role) and let it derive
  // the groups itself from the statically-imported SETTINGS_NAV.
  const groups = useMemo(() => getSettingsNav({ vertical, role }), [vertical, role]);
  const counts = useMemo(() => getSettingsNavCounts({ vertical, role }), [vertical, role]);

  return (
    <nav aria-label="Settings navigation" className="hidden w-60 shrink-0 border-r pr-4 sm:block">
      <div className="sticky top-4 space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-2 px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isSettingsItemActive(pathname, item);
                const Icon = item.icon;
                const graduates = GRADUATE_HREFS.has(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-foreground font-semibold text-background'
                          : 'text-foreground hover:bg-accent',
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {graduates ? (
                        <ArrowUpRight
                          aria-hidden
                          className={cn(
                            'size-3 shrink-0',
                            active ? 'text-background/60' : 'text-muted-foreground/60',
                          )}
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <SettingsNavFoot counts={counts} />
      </div>
    </nav>
  );
}
