/**
 * Single source of truth for the settings sidebar + mobile nav.
 *
 * Edit this file to add / remove / reorder settings items. Both the
 * desktop sidebar and the mobile <select> read from here, so they stay
 * in lockstep automatically.
 *
 * `href` is the canonical route. The active-state highlight uses a
 * startsWith match so nested orphan routes (e.g. /settings/qbo-history)
 * light up their parent (QuickBooks) without explicit configuration.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Bot,
  Building2,
  Calendar,
  CreditCard,
  Database,
  Eye,
  FileText,
  HardHat,
  History,
  Layers,
  Mic,
  Receipt,
  Ruler,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  Type,
  Upload,
  User,
  Users,
  Wallet,
} from 'lucide-react';

export type SettingsNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type SettingsNavGroup = {
  /** Uppercase label shown above the items in the sidebar. */
  label: string;
  items: SettingsNavItem[];
};

export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    label: 'Account',
    items: [
      { title: 'Business profile', href: '/settings/profile', icon: Building2 },
      { title: 'Your profile', href: '/settings/your-profile', icon: User },
      { title: 'Security', href: '/settings/security', icon: ShieldCheck },
      { title: 'Audit log', href: '/settings/audit', icon: History },
      { title: 'Team & workers', href: '/settings/team', icon: Users },
      { title: 'Delete account', href: '/settings/account/delete', icon: Trash2 },
    ],
  },
  {
    label: 'Billing & plan',
    items: [{ title: 'Billing & plan', href: '/settings/billing', icon: CreditCard }],
  },
  {
    label: 'Estimating & quotes',
    items: [
      { title: 'Project defaults', href: '/settings/project-defaults', icon: TrendingUp },
      { title: 'Estimating detail level', href: '/settings/estimating', icon: Ruler },
      { title: 'Pricebook', href: '/settings/pricebook', icon: Tag },
      { title: 'Cost catalog', href: '/settings/cost-catalog', icon: HardHat },
      { title: 'Budget templates', href: '/settings/budget-category-templates', icon: Layers },
      { title: 'Estimate snippets', href: '/settings/estimate-snippets', icon: FileText },
      { title: 'Quotes', href: '/settings/quotes', icon: FileText },
      { title: 'Document labels', href: '/settings/document-labels', icon: Type },
    ],
  },
  {
    label: 'Money & integrations',
    items: [
      { title: 'Stripe', href: '/settings/stripe', icon: Wallet },
      { title: 'QuickBooks', href: '/settings/quickbooks', icon: Receipt },
      { title: 'Payment sources', href: '/settings/payment-sources', icon: CreditCard },
      { title: 'Invoicing', href: '/settings/invoicing', icon: FileText },
      { title: 'Expense categories', href: '/settings/categories', icon: Tag },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Automations', href: '/settings/automations', icon: Bot },
      { title: 'Reminders', href: '/settings/reminders', icon: Bell },
      { title: 'Checklist settings', href: '/settings/checklist', icon: Layers },
      { title: 'Customer portal', href: '/settings/customer-portal', icon: Eye },
    ],
  },
  {
    label: 'Data & tools',
    items: [
      { title: 'Calendar feed', href: '/settings/calendar', icon: Calendar },
      { title: 'Data export', href: '/settings/data-export', icon: Database },
      { title: 'Import data', href: '/import', icon: Upload },
      { title: 'Voice', href: '/settings/voice', icon: Mic },
    ],
  },
];

/** Flat list of every nav item — handy for tests, search, lookups. */
export const ALL_SETTINGS_ITEMS: SettingsNavItem[] = SETTINGS_NAV.flatMap((g) => g.items);

/** True when `pathname` belongs to the given nav item — exact match or a
 *  nested subpath. Nested orphan routes (e.g. /settings/qbo-history) light
 *  up their parent (QuickBooks at /settings/quickbooks) so the sidebar
 *  never shows "nothing selected." */
export function isSettingsItemActive(pathname: string, item: SettingsNavItem): boolean {
  if (pathname === item.href) return true;
  return pathname.startsWith(`${item.href}/`);
}

/** The three tenant-member roles that can reach /settings. Workers and
 *  clients never land here (the dashboard layout redirects them away), so
 *  the nav only ever filters across owner / admin / member. */
export type SettingsRole = 'owner' | 'admin' | 'member';

/** Context for filtering the nav: the tenant's vertical (hides
 *  vertical-irrelevant items like Pricebook on GC) and the viewer's role
 *  (hides destinations they can't use — defense-in-depth on top of the
 *  per-page server gate, so the nav stops advertising owner-only pages). */
export type SettingsNavContext = { vertical: string | null; role: SettingsRole };

const GC_VERTICALS = new Set(['renovation', 'gc', 'general_contractor']);

/** True when the operator's day-to-day workflow is GC-style — they build
 *  scopes in the project Budget tab, not from a saved pricebook. */
function isGcVertical(vertical: string | null): boolean {
  return vertical != null && GC_VERTICALS.has(vertical);
}

/**
 * Per-role hide-set — the single place Ops tweaks the role × destination
 * matrix. A role sees an item iff its `href` is NOT in that role's set.
 * Owner sees everything (empty set); the vertical filter still applies on
 * top for every role.
 *
 * The nav filter is *defense-in-depth*, not the gate — every owner-only
 * page already enforces the role on the server. This just stops the nav
 * advertising destinations the viewer can't act on.
 *
 * Matrix confirmed by Ops for owner + member. Admin is a reasonable
 * DEFAULT pending an explicit Ops confirm — see ADMIN comment below.
 */
const ROLE_HIDDEN_HREFS: Record<SettingsRole, ReadonlySet<string>> = {
  // Owner: the full hub — billing, security, account deletion, the lot.
  owner: new Set<string>(),

  // Admin (NOT explicitly confirmed by Ops — reasonable default, FLAGGED
  // for Ops to adjust): admins run the team day-to-day, so they KEEP
  // Security + Team & workers. They only lose the owner-exclusive
  // money / account-destruction group: Billing, Data export, Delete
  // account. If Ops wants admins fully out of Security too, move
  // '/settings/security' into this set.
  admin: new Set<string>([
    '/settings/billing',
    '/settings/data-export',
    '/settings/account/delete',
  ]),

  // Member: operational only. Hides Security, Team & workers, Billing,
  // Delete account, and Data export. KEEPS the Audit log (the render's
  // assumption wins over the brief's stricter table — confirmed).
  member: new Set<string>([
    '/settings/security',
    '/settings/team',
    '/settings/billing',
    '/settings/account/delete',
    '/settings/data-export',
  ]),
};

/** Returns the nav groups filtered for the current tenant + role. Used by
 *  the layout to drop items that don't belong to this operator's workflow
 *  or that their role can't act on. */
export function getSettingsNav(ctx: SettingsNavContext): SettingsNavGroup[] {
  return SETTINGS_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => shouldShowItem(item, ctx)),
  })).filter((group) => group.items.length > 0);
}

function shouldShowItem(item: SettingsNavItem, ctx: SettingsNavContext): boolean {
  // Role gate (defense-in-depth — the page still enforces server-side).
  if (ROLE_HIDDEN_HREFS[ctx.role].has(item.href)) return false;

  // Pricebook is consumed by the older single-quote flow + AI catalog
  // tool — neither part of the GC project workflow. GC operators build
  // scope from the project Budget tab; zero of the 336 priced cost
  // lines on prod ever referenced a catalog item. Hide for GC verticals
  // until we either wire it into the project flow or remove it.
  if (item.href === '/settings/pricebook' && isGcVertical(ctx.vertical)) return false;
  return true;
}

/** Honest accounting of the nav for the settings-foot summary. Derived
 *  from the same SETTINGS_NAV + filters so the count can never drift from
 *  what's actually rendered.
 *  - `hiddenForRole`  — items this role can't act on (owner-only pages).
 *  - `hiddenForVertical` — items irrelevant to this vertical (Pricebook on GC).
 *  - `graduate` — heavy sub-flows that link out to their own surfaces
 *                 (Team, Billing, QuickBooks, Import) — they're SHOWN, but
 *                 worth calling out as deeper destinations.
 *  Graduate items are still counted in `shown`; the others reduce it. */
export const GRADUATE_HREFS: ReadonlySet<string> = new Set([
  '/settings/team',
  '/settings/billing',
  '/settings/quickbooks',
  '/import',
]);

export type SettingsNavCounts = {
  total: number;
  shown: number;
  hiddenForRole: number;
  hiddenForVertical: number;
  graduate: number;
};

export function getSettingsNavCounts(ctx: SettingsNavContext): SettingsNavCounts {
  const total = ALL_SETTINGS_ITEMS.length;
  let hiddenForRole = 0;
  let hiddenForVertical = 0;
  let shown = 0;
  let graduate = 0;

  for (const item of ALL_SETTINGS_ITEMS) {
    const roleHidden = ROLE_HIDDEN_HREFS[ctx.role].has(item.href);
    const verticalHidden = item.href === '/settings/pricebook' && isGcVertical(ctx.vertical);
    // Role takes precedence in the tally so a single hidden item isn't
    // double-counted (Billing is both owner-only and could-be-vertical).
    if (roleHidden) {
      hiddenForRole++;
    } else if (verticalHidden) {
      hiddenForVertical++;
    } else {
      shown++;
      if (GRADUATE_HREFS.has(item.href)) graduate++;
    }
  }

  return { total, shown, hiddenForRole, hiddenForVertical, graduate };
}
