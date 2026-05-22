import Link from 'next/link';
import { Suspense } from 'react';
import { TabSkeleton } from '@/components/features/projects/tabs/tab-skeleton';
import MessagesTabServer from './messages-tab-server';
import PortalTabServer from './portal-tab-server';
import SelectionsTabServer from './selections-tab-server';

export type ClientSubtab = 'messages' | 'selections' | 'portal';

/**
 * Client hub — the operator-side mirror of the customer relationship,
 * grouping the three homeowner-facing surfaces (Messages · Selections ·
 * Portal & Updates) behind one tab. Defaults to Messages (most-used). The
 * unread badge lives on the parent `Client` nav tab; per-subhead badges
 * repeat the breakdown here.
 *
 * Sub-navigation is URL-driven via `?tab=client&client=<subtab>` so each
 * subhead is linkable and the back button works.
 */
export default function ClientHubTabServer({
  projectId,
  subtab,
  unreadMessages,
  unreadIdeas,
}: {
  projectId: string;
  subtab: ClientSubtab;
  unreadMessages: number;
  unreadIdeas: number;
}) {
  const subtabs: { key: ClientSubtab; label: string; badge: number }[] = [
    { key: 'messages', label: 'Messages', badge: unreadMessages },
    { key: 'selections', label: 'Selections', badge: unreadIdeas },
    { key: 'portal', label: 'Portal & Updates', badge: 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 border-b">
        {subtabs.map((s) => {
          const active = subtab === s.key;
          return (
            <Link
              key={s.key}
              href={`/projects/${projectId}?tab=client&client=${s.key}`}
              prefetch={false}
              className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground'
              }`}
            >
              {s.label}
              {s.badge > 0 ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {s.badge > 9 ? '9+' : s.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <Suspense key={subtab} fallback={<TabSkeleton />}>
        {subtab === 'messages' ? <MessagesTabServer projectId={projectId} /> : null}
        {subtab === 'selections' ? <SelectionsTabServer projectId={projectId} /> : null}
        {subtab === 'portal' ? <PortalTabServer projectId={projectId} /> : null}
      </Suspense>
    </div>
  );
}
