import Link from 'next/link';
import { WorklogEntryTypeBadge } from '@/components/features/inbox/worklog-entry-type-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/date/format';
import type { RecentWorklogEntry } from '@/lib/db/queries/dashboard';
import type { WorklogEntryType } from '@/lib/validators/worklog';

function relatedHref(relatedType: string | null, relatedId: string | null): string | null {
  if (!relatedType || !relatedId) return null;
  switch (relatedType) {
    case 'customer':
      return `/contacts/${relatedId}`;
    case 'project':
      return `/projects/${relatedId}`;
    case 'quote':
      return `/quotes/${relatedId}`;
    case 'job':
      return `/jobs/${relatedId}`;
    case 'invoice':
      return `/invoices/${relatedId}`;
    default:
      return null;
  }
}

export function RecentActivity({
  entries,
  timezone,
}: {
  entries: RecentWorklogEntry[];
  timezone: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Activity</CardTitle>
        <Link href="/inbox" className="text-sm text-primary underline underline-offset-4">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const href = relatedHref(entry.related_type, entry.related_id);
              const titleText = entry.title ?? 'Untitled entry';
              const body = (
                <>
                  <WorklogEntryTypeBadge entryType={entry.entry_type as WorklogEntryType} />
                  <span className="truncate flex-1">
                    {titleText}
                    {entry.related_name ? (
                      <span className="text-muted-foreground"> — {entry.related_name}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(entry.created_at, { timezone })}
                  </span>
                </>
              );
              return (
                <li key={entry.id}>
                  {href ? (
                    <Link
                      href={href}
                      className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 text-sm hover:bg-muted"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 text-sm">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
