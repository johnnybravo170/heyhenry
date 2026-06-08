/**
 * Two-column shell for the entire /settings/* section.
 *
 * Left: persistent sidebar (or mobile <select>) listing every settings
 * destination, grouped by area. Stays mounted across navigations.
 *
 * Right: the active subpage. Wider than the rest of the app (max-w-3xl
 * gets cramped once a sidebar eats 240px on the left).
 *
 * Server component — fetches the tenant's vertical so the nav can drop
 * items that don't belong to this operator's workflow (e.g. Pricebook
 * for GC verticals).
 */

import { SettingsMobileNav } from '@/components/features/settings/settings-mobile-nav';
import type { SettingsRole } from '@/components/features/settings/settings-nav-items';
import { SettingsSidebar } from '@/components/features/settings/settings-sidebar';
import { getCurrentTenant } from '@/lib/auth/helpers';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  // Pass primitives (vertical + role) to the client components — they
  // derive the filtered nav locally. Lucide icon refs can't be serialized
  // across the server→client boundary.
  const vertical = tenant?.vertical ?? null;
  // Roles that reach /settings are owner | admin | member; worker/client
  // never get here (the dashboard layout redirects them). Default to the
  // most-restrictive role if somehow unset so the nav errs closed.
  const role: SettingsRole =
    tenant?.member.role === 'owner' || tenant?.member.role === 'admin'
      ? tenant.member.role
      : 'member';

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6">
      <SettingsSidebar vertical={vertical} role={role} />
      <div className="min-w-0 flex-1">
        <SettingsMobileNav vertical={vertical} role={role} />
        {children}
      </div>
    </div>
  );
}
