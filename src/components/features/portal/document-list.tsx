'use client';

/**
 * Operator-side document list grouped by type. Each row shows title +
 * size + uploaded date + optional expiry, with a per-doc Hide/Show
 * (client-visibility) toggle and an AlertDialog-guarded delete.
 *
 * Visibility legibility is the #1 trust signal here: every row carries a
 * label + glyph VisibilityBadge (never colour-only). Docs default to
 * client-visible; COIs are seeded internal (sub-compliance paperwork). The
 * data model (`client_visible`) already encodes this — we surface it.
 */

import { FileText, Loader2, Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTenantTimezone } from '@/lib/auth/tenant-context';
import { formatDate } from '@/lib/date/format';
import type { ProjectDocumentWithUrl } from '@/lib/db/queries/project-documents';
import {
  DOCUMENT_TYPE_DISPLAY_ORDER,
  type DocumentType,
  documentTypeLabels,
} from '@/lib/validators/project-document';
import {
  deleteProjectDocumentAction,
  setDocumentClientVisibleAction,
} from '@/server/actions/project-documents';
import { VisibilityBadge } from '../projects/visibility-badge';

function humanBytes(n: number | null): string {
  if (!n || n <= 0) return '';
  const k = 1024;
  if (n < k) return `${n} B`;
  if (n < k * k) return `${(n / k).toFixed(1)} KB`;
  return `${(n / k / k).toFixed(1)} MB`;
}

// COIs (certificates of insurance) are sub-compliance docs — usually held
// internal. We surface the convention as a one-line group note so the
// default reads as intentional, not a bug.
const TYPE_NOTE: Partial<Record<DocumentType, string>> = {
  coi: 'Sub compliance — usually internal',
};

export function DocumentList({
  documents,
  projectId,
}: {
  documents: ProjectDocumentWithUrl[];
  projectId: string;
}) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No documents yet. Upload contracts, permits, warranties, manuals — they&rsquo;ll appear on
        the client&rsquo;s portal and in the final Property Record.
      </p>
    );
  }

  // Bucket by type, ordered by display preference.
  const buckets = new Map<DocumentType, ProjectDocumentWithUrl[]>();
  for (const doc of documents) {
    const list = buckets.get(doc.type) ?? [];
    list.push(doc);
    buckets.set(doc.type, list);
  }
  const orderedTypes = DOCUMENT_TYPE_DISPLAY_ORDER.filter((t) => (buckets.get(t)?.length ?? 0) > 0);

  return (
    <div className="space-y-4">
      {orderedTypes.map((type) => {
        const docs = buckets.get(type) ?? [];
        return (
          <div key={type} className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                {documentTypeLabels[type]}
              </h3>
              <span className="font-mono text-xs text-muted-foreground">{docs.length}</span>
              {TYPE_NOTE[type] ? (
                <span className="text-xs text-muted-foreground">· {TYPE_NOTE[type]}</span>
              ) : null}
            </div>
            <ul className="divide-y">
              {docs.map((d) => (
                <DocumentRow key={d.id} doc={d} projectId={projectId} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function DocumentRow({ doc, projectId }: { doc: ProjectDocumentWithUrl; projectId: string }) {
  const tz = useTenantTimezone();
  const [pending, startTransition] = useTransition();

  // Surface an expiry warning for time-bound paperwork (COIs, permits) so a
  // lapsed certificate is visible at a glance.
  const expiresSoon =
    doc.expires_at != null && new Date(doc.expires_at).getTime() < Date.now() + 30 * 86_400_000;
  const expired = doc.expires_at != null && new Date(doc.expires_at).getTime() < Date.now();

  function onToggleVisibility() {
    const next = !doc.client_visible;
    startTransition(async () => {
      const res = await setDocumentClientVisibleAction(doc.id, projectId, next);
      if (!res.ok) toast.error(res.error);
      else toast.success(next ? 'Now visible to client' : 'Hidden from client');
    });
  }

  function onDelete() {
    startTransition(async () => {
      const res = await deleteProjectDocumentAction(doc.id, projectId);
      if (!res.ok) toast.error(res.error);
      else toast.success('Document deleted.');
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        {doc.url ? (
          <a
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-medium hover:underline"
            title={doc.title}
          >
            {doc.title}
          </a>
        ) : (
          <span className="block truncate text-sm font-medium">{doc.title}</span>
        )}
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {humanBytes(doc.bytes) ? <span>{humanBytes(doc.bytes)}</span> : null}
          <span>Added {formatDate(doc.created_at, { timezone: tz })}</span>
          {doc.expires_at ? (
            <span className={expiresSoon ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}>
              {expired ? 'Expired' : 'Expires'} {formatDate(doc.expires_at, { timezone: tz })}
            </span>
          ) : null}
        </div>
      </div>
      <VisibilityBadge clientVisible={doc.client_visible} className="hidden sm:inline-flex" />
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={doc.client_visible ? 'Hide from client' : 'Show to client'}
          title={doc.client_visible ? 'Hide from client' : 'Show to client'}
          onClick={onToggleVisibility}
          disabled={pending}
          className="text-xs"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : doc.client_visible ? (
            'Hide'
          ) : (
            'Show'
          )}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Delete document"
              disabled={pending}
            >
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{doc.title}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>This can&rsquo;t be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                disabled={pending}
                className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                {pending ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}
