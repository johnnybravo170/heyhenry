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
import { notFound, redirect } from 'next/navigation';
import { IntakeRowActions } from '@/components/features/inbox/intake-row-actions';
import { IntakeSourceChip } from '@/components/features/inbox/intake-source-chip';
import { getCurrentTenant } from '@/lib/auth/helpers';
import { type InboxIntakeRow, loadIntakeDraft } from '@/lib/db/queries/intake-drafts';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validators/uuid';

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
  if (!isUuid(id)) notFound();

  const tenant = await getCurrentTenant();
  if (!tenant) {
    redirect(`/login?next=/inbox/intake/${id}`);
  }

  const draft = await loadIntakeDraft(id);
  if (!draft) notFound();

  const extraction = draft.ai_extraction?.[draft.ai_extraction.active] ?? draft.ai_extraction?.v1;

  // Load active projects for the action dialogs (apply → bill / document /
  // photo / message all need a project picker), then build the row shape
  // IntakeRowActions expects from the loaded draft. Actions live here AND
  // on the list row so the operator can act from wherever they opened it.
  const supabase = await createClient();
  const { data: projectsRaw } = await supabase
    .from('projects')
    .select('id, name')
    .eq('tenant_id', tenant.id)
    .is('deleted_at', null)
    .in('lifecycle_stage', ['planning', 'awaiting_approval', 'active'])
    .order('name');
  const projects = (projectsRaw ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
  }));

  const firstArtifact = draft.artifacts[0] ?? null;
  const actionRow: InboxIntakeRow = {
    id: draft.id,
    source: draft.source,
    disposition: draft.disposition,
    status: draft.status,
    customer_name: draft.customer_name,
    primary_kind: firstArtifact?.kind ?? null,
    primary_artifact_path: firstArtifact?.path ?? null,
    primary_artifact_mime: firstArtifact?.mime ?? null,
    primary_artifact_bytes: firstArtifact?.size ?? null,
    thumbnail_url: null,
    artifact_count: draft.artifacts.length,
    email_subject: null,
    email_from: null,
    accepted_project_id: draft.accepted_project_id,
    recognized_customer_id: draft.recognized_customer_id,
    recognized_project_id: draft.recognized_project_id,
    applied_destination_kind: null,
    applied_destination_id: null,
    applied_at: null,
    created_at: draft.created_at,
  };

  // Resolve recognized_project_id to a name for the hint chip.
  const recognizedProject = draft.recognized_project_id
    ? (projects.find((p) => p.id === draft.recognized_project_id) ?? null)
    : null;

  return (
    <div className="space-y-5">
      <Link
        href="/inbox/intake"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to inbox
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
        <IntakeRowActions row={actionRow} projects={projects} />
      </header>

      {draft.error_message && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {draft.error_message}
        </p>
      )}

      {/* Recognized project hint */}
      {recognizedProject && (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Matched project: </span>
          <Link href={`/projects/${recognizedProject.id}`} className="font-medium hover:underline">
            {recognizedProject.name}
          </Link>
          <span className="ml-1 text-xs text-muted-foreground">(from email text)</span>
        </p>
      )}

      {/* Artifacts */}
      {draft.artifacts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Artifacts ({draft.artifacts.length})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {draft.artifacts.map((a) => {
              const isImage = a.mime?.startsWith('image/');
              const isPdf = a.mime === 'application/pdf';
              const bill = a.bill_extract ?? null;
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
                    ) : isPdf && a.signedUrl ? (
                      <iframe
                        src={`${a.signedUrl}#toolbar=0&navpanes=0&view=FitH`}
                        title={a.label ?? a.name}
                        className="size-full"
                      />
                    ) : (
                      <FileText className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <p className="truncate text-xs font-medium">
                    {a.kind ? (KIND_LABEL[a.kind] ?? a.kind) : 'Unclassified'}
                  </p>
                  {a.label && <p className="truncate text-xs text-muted-foreground">{a.label}</p>}
                  {/* Bill extract from PDF OCR — amount / vendor / date */}
                  {bill && (bill.amountCents != null || bill.vendor || bill.date) ? (
                    <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      {bill.amountCents != null && <p>${(bill.amountCents / 100).toFixed(2)}</p>}
                      {bill.vendor && <p className="truncate">{bill.vendor}</p>}
                      {bill.date && <p>{bill.date}</p>}
                    </div>
                  ) : null}
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
