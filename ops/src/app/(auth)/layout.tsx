import Link from 'next/link';
import { requireAdmin } from '@/lib/ops-gate';
import { MobileNav } from './mobile-nav';
import { MoreMenu } from './more-menu';
import { SignOutButton } from './sign-out-button';

// Primary nav: the human-facing surfaces Jonathan actually steers from.
// Command Center is the daily landing spot, so it sits first after the
// dashboard. The agent-operational surfaces (kanban, worklog, ideas,
// knowledge, decisions) are where agents write — they live in MORE_NAV,
// reachable but out of the way. Resist growing this list.
const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/admin/queue', label: 'Command Center' },
  { href: '/agents', label: 'Agents' },
  { href: '/board', label: 'Board' },
  { href: '/message-lab', label: 'Message Lab' },
];

// Agent-operational + lower-frequency admin surfaces, behind a "More"
// disclosure. The first group is where agents do their reading/writing
// (you dip in to inspect, not to drive). `memory-guide` is intentionally
// NOT here — it's a Claude/MCP surface (via `ops_memory_guide`), not a
// human one; the page still exists at /admin/memory-guide for direct access.
const MORE_NAV = [
  { href: '/admin/kanban', label: 'Kanban' },
  { href: '/worklog', label: 'Worklog' },
  { href: '/ideas', label: 'Ideas' },
  { href: '/admin/scout-policy', label: 'Scout Policy' },
  { href: '/knowledge', label: 'Knowledge' },
  { href: '/decisions', label: 'Decisions' },
  { href: '/admin/launch', label: 'Launch' },
  { href: '/admin/stats', label: 'Stats' },
  { href: '/admin/slo', label: 'SLO' },
  { href: '/admin/keys', label: 'API Keys' },
  { href: '/admin/mcp', label: 'MCP' },
  { href: '/admin/audit', label: 'Audit Log' },
];

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-6">
          <span className="text-sm font-semibold tracking-tight">HeyHenry Ops</span>
          <nav className="hidden items-center gap-4 text-sm md:flex">
            {PRIMARY_NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {n.label}
              </Link>
            ))}
            <MoreMenu items={MORE_NAV} />
          </nav>
          <div className="ml-auto hidden items-center gap-3 text-xs text-[var(--muted-foreground)] md:flex">
            <span title={admin.email}>{admin.email.split('@')[0]}</span>
            <SignOutButton />
          </div>
          <div className="ml-auto md:hidden">
            <MobileNav primary={PRIMARY_NAV} more={MORE_NAV} email={admin.email} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
