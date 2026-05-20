/**
 * Per-draft detail view for the universal inbox.
 *
 * Read-only deep view of a single intake_draft: source + disposition,
 * artifact previews (signed thumbnails / PDF links), the classifier's
 * per-artifact kind + label, the forwarded envelope / pasted text, the
 * AI-extracted brief, and any scope augmentations. Operator actions
 * (apply / edit / move / undo / dismiss) live on the list row — this is
 * the "what did Henry see and decide" inspection surface that the row's
 * "Open" link and the alias lead-notification email point at.
 */

import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IntakeSourceChip } from '@/components/features/inbox/intake-source-chip';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { loadIntakeDraft } from '@/lib/db/queries/intake-drafts';

const KIND_LABEL: Record<string, string> = {
  voice_memo: 'Voice memo',
  damage_photo: 'Damage photo',
  reference_photo: 'Reference photo',
  sketch: 'Sketch',
  screenshot: 'Screenshot',
  sub_quote_pdf: 'Sub-trade quote',
  spec_drawing_pdf: 'Spec / drawing',
  receipt: 'Receipt',
  inspiration_photo: 'Inspiration',
  customer_message: 'Customer message',
  text_body: 'Email body',
  other: 'Artifact',
};

const DISPOSITION_LABEL: Record<string, string> = {
  pending_review: 'Needs review',
  applied: 'Applied',
  dismissed: 'Dismissed',
  error: 'Error',
};

export const metadata = { title: 'Intake item — Inbox — HeyHenry' };

export default async function IntakeDraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tenant = await getCurrentTenant();
  if (!tenant) {
    return <p className="text-sm text-muted-foreground">Not signed in.</p>;
  }

  const draft = await loadIntakeDraft(id);
  if (!draft) notFound();

  const extraction = draft.ai_extraction?.[draft.ai_extraction.active] ?? draft.ai_extraction?.v1;

  return (
    <div className="space-y-5">
      <Link
        href="/inbox/intake"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to inbox
      </Link>

      <header className="flex flex-wrap items-center gap-2">
        <IntakeSourceChip source={draft.source} />
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {DISPOSITION_LABEL[draft.disposition] ?? draft.disposition}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          parser: {draft.status}
        </span>
        {draft.parsed_by && (
          <span className="text-xs text-muted-foreground">{draft.parsed_by}</span>
        )}
      </header>

      {draft.error_message && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {draft.error_message}
        </p>
      )}

      {/* Artifacts */}
      {draft.artifacts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Artifacts ({draft.artifacts.length})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {draft.artifacts.map((a) => {
              const isImage = a.mime?.startsWith('image/');
              return (
                <div key={a.path} className="rounded-lg border bg-card p-3">
                  <div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                    {isImage && a.signedUrl ? (
                      // biome-ignore lint/performance/noImgElement: signed URL not in next/image domains
                      <img
                        src={a.signedUrl}
                        alt={a.label ?? a.name}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <FileText className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <p className="truncate text-xs font-medium">
                    {a.kind ? (KIND_LABEL[a.kind] ?? a.kind) : 'Unclassified'}
                  </p>
                  {a.label && <p className="truncate text-xs text-muted-foreground">{a.label}</p>}
                  {a.signedUrl && (
                    <a
                      href={a.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Open file
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Forwarded envelope / pasted text */}
      {draft.pasted_text && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Forwarded content</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-xs">
            {draft.pasted_text}
          </pre>
        </section>
      )}

      {/* AI-extracted brief */}
      {extraction && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Henry&rsquo;s read</h2>
          <div className="rounded-lg border bg-card p-3 text-sm">
            {extraction.customer?.name && (
              <p>
                <span className="text-muted-foreground">Customer:</span> {extraction.customer.name}
              </p>
            )}
            {extraction.project?.name && (
              <p>
                <span className="text-muted-foreground">Project:</span> {extraction.project.name}
              </p>
            )}
            {extraction.project?.description && (
              <p className="mt-1 text-muted-foreground">{extraction.project.description}</p>
            )}
            {extraction.categories?.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-muted-foreground">
                {extraction.categories.map((c) => (
                  <li key={c.name}>
                    {c.name} ({c.lines?.length ?? 0} line{c.lines?.length === 1 ? '' : 's'})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Apply, edit, move, and undo live on the inbox list row.{' '}
        <Link href="/inbox/intake" className="underline hover:text-foreground">
          Back to inbox →
        </Link>
      </p>
    </div>
  );
}
