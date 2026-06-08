import { Eye, Share2 } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { TabSkeleton } from '@/components/features/projects/tabs/tab-skeleton';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
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
export default async function ClientHubTabServer({
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

  // Portal status for the cross-subhead chip — one source of truth so
  // every subtab can see whether the client portal is on (delta #4).
  const supabase = await createClient();
  const { data: portalRow } = await supabase
    .from('projects')
    .select('portal_enabled, portal_slug')
    .eq('id', projectId)
    .single();
  const portalEnabled = Boolean(portalRow?.portal_enabled);
  const portalSlug = (portalRow?.portal_slug as string | null) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b">
        <div className="flex flex-wrap gap-1">
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
        <PortalStatusChip
          projectId={projectId}
          portalEnabled={portalEnabled}
          portalSlug={portalSlug}
        />
      </div>

      <Suspense key={subtab} fallback={<TabSkeleton />}>
        {subtab === 'messages' ? <MessagesTabServer projectId={projectId} /> : null}
        {subtab === 'selections' ? <SelectionsTabServer projectId={projectId} /> : null}
        {subtab === 'portal' ? <PortalTabServer projectId={projectId} /> : null}
      </Suspense>
    </div>
  );
}

/**
 * Cross-subhead portal-status chip — "● Portal on · /portal/slug · Preview"
 * or "○ Portal off · Set up". Legible from every subhead so the operator
 * always knows what the client can see. Preview opens the live portal;
 * Share/Set up routes to the Portal & Updates subtab where the full
 * PortalToggle (enable + multi-recipient share) lives — one source of truth.
 */
function PortalStatusChip({
  projectId,
  portalEnabled,
  portalSlug,
}: {
  projectId: string;
  portalEnabled: boolean;
  portalSlug: string | null;
}) {
  return (
    <div className="ml-auto inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground">
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full ring-4',
          portalEnabled
            ? 'bg-emerald-500 ring-emerald-500/15'
            : 'bg-muted-foreground/40 ring-muted',
        )}
        aria-hidden
      />
      <span className={portalEnabled ? 'text-foreground' : 'text-muted-foreground'}>
        Portal {portalEnabled ? 'on' : 'off'}
      </span>
      {portalEnabled && portalSlug ? (
        <span className="font-mono text-[11px] font-normal text-muted-foreground">
          /portal/{portalSlug}
        </span>
      ) : null}
      <span className="text-muted-foreground/40" aria-hidden>
        ·
      </span>
      {portalEnabled && portalSlug ? (
        <a
          href={`/portal/${portalSlug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
        >
          <Eye className="size-3 text-muted-foreground" />
          Preview
        </a>
      ) : null}
      <Link
        href={`/projects/${projectId}?tab=client&client=portal`}
        prefetch={false}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
      >
        <Share2 className="size-3 text-muted-foreground" />
        {portalEnabled ? 'Share' : 'Set up'}
      </Link>
    </div>
  );
}
