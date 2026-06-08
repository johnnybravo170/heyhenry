import Link from 'next/link';
import { MessagesThread } from '@/components/features/messages/messages-thread';
import { createClient } from '@/lib/supabase/server';
import { statusToneClass } from '@/lib/ui/status-tokens';
import { cn } from '@/lib/utils';
import type { MessageRow } from '@/server/actions/project-messages';

export default async function MessagesTabServer({ projectId }: { projectId: string }) {
  const supabase = await createClient();

  const [{ data: messages }, { data: portalData }] = await Promise.all([
    supabase
      .from('project_messages')
      .select(
        'id, sender_kind, sender_label, channel, direction, body, created_at, read_by_operator_at, read_by_customer_at',
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
    supabase
      .from('projects')
      .select('portal_slug, portal_enabled, contacts:contact_id (name)')
      .eq('id', projectId)
      .single(),
  ]);

  const initialMessages = (messages ?? []) as MessageRow[];
  const portalEnabled = Boolean(portalData?.portal_enabled);
  const portalSlug = (portalData?.portal_slug as string | null) ?? null;
  const customerRaw = portalData?.contacts as
    | { name?: string }
    | { name?: string }[]
    | null
    | undefined;
  const customer = Array.isArray(customerRaw) ? (customerRaw[0] ?? null) : (customerRaw ?? null);
  const customerName = customer?.name ?? 'Customer';

  return (
    <div className="space-y-4">
      {!portalEnabled ? (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border px-3 py-2.5 text-[13px]',
            statusToneClass.info,
          )}
        >
          <span>
            Portal is off — messages still notify the client, but they can&apos;t read the thread on
            their portal.
          </span>
          <Link
            href={`/projects/${projectId}?tab=client&client=portal`}
            className="font-semibold underline underline-offset-2"
          >
            Enable portal →
          </Link>
        </div>
      ) : null}
      <MessagesThread
        projectId={projectId}
        initialMessages={initialMessages}
        customerName={customerName}
        portalSlug={portalSlug}
      />
    </div>
  );
}
