/**
 * Permanent Property Record share page. Slice 6a of the Customer Portal &
 * Property Record build.
 *
 * Reads the frozen JSONB snapshot from `property_records` keyed on slug and
 * renders the full handoff document — header / phases / decisions /
 * change orders / selections / photos / documents. Server component
 * end-to-end (no JS) — clients, spouses, realtors, insurers,
 * future contractors all just open the link.
 *
 * Storage paths in the snapshot are re-signed via the admin client at
 * render time. Signed URLs only live ~1 week, so we re-sign on every
 * request. The snapshot itself is permanent; only the rendering is
 * dynamic.
 */

import { Archive, Download, ExternalLink, FileText, Layers } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PublicViewLogger } from '@/components/features/public/public-view-logger';
import type { PropertyRecordSnapshotV1 } from '@/lib/db/queries/property-records';
import { createAdminClient } from '@/lib/supabase/admin';
import { cn } from '@/lib/utils';
import {
  PORTAL_PHOTO_TAG_DISPLAY_ORDER,
  type PortalPhotoTag,
  portalPhotoTagLabels,
} from '@/lib/validators/portal-photo';
import {
  DOCUMENT_TYPE_DISPLAY_ORDER,
  type DocumentType,
  documentTypeLabels,
} from '@/lib/validators/project-document';
import {
  type SelectionCategory,
  selectionCategoryLabels,
} from '@/lib/validators/project-selection';

export const metadata = {
  title: 'Property Record — HeyHenry',
};

const cadFormat = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

function formatDate(iso: string | null | undefined, tz: string | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'long',
    timeZone: tz ?? 'America/Vancouver',
  }).format(new Date(iso));
}

export default async function PropertyRecordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: record } = await admin
    .from('property_records')
    .select('snapshot, generated_at, project_id, pdf_path, zip_path')
    .eq('slug', slug)
    .single();
  if (!record) notFound();

  const snapshot = (record as Record<string, unknown>).snapshot as PropertyRecordSnapshotV1;
  const hasPdf = Boolean((record as Record<string, unknown>).pdf_path);
  const hasZip = Boolean((record as Record<string, unknown>).zip_path);

  // Snapshots written 2026-05-08+ carry their tenant's tz at generation
  // time. Older snapshots side-query the live tenant tz; if even that
  // misses, fall back to Vancouver. Frozen-tz preferred — the Property Record
  // is permanent, so dates should reflect when the contractor was
  // actually doing the work, not where the business is now.
  let tenantTz: string | undefined = snapshot.timezone;
  if (!tenantTz) {
    const projectId = (record as Record<string, unknown>).project_id as string;
    const { data: tenantRow } = await admin
      .from('projects')
      .select('tenants:tenant_id (timezone)')
      .eq('id', projectId)
      .single();
    const tenantNode = (tenantRow as Record<string, unknown> | null)?.tenants as
      | { timezone?: string | null }
      | { timezone?: string | null }[]
      | null;
    const tenantObj = Array.isArray(tenantNode) ? tenantNode[0] : tenantNode;
    tenantTz = tenantObj?.timezone ?? undefined;
  }

  // Re-sign all storage paths in one batch (separate buckets, so two
  // calls — photos + project-docs).
  const photoPaths = snapshot.photos.map((p) => p.storage_path);
  const docPaths = snapshot.documents.map((d) => d.storage_path);

  // Logo lives in the photos bucket too — bundle into the same batch
  // sign call to avoid an extra round trip.
  const logoPath = snapshot.contractor.logo_storage_path;
  const allPhotoPaths = logoPath ? [...photoPaths, logoPath] : photoPaths;

  const photoUrlMap = new Map<string, string>();
  if (allPhotoPaths.length > 0) {
    const { data: signed } = await admin.storage
      .from('photos')
      .createSignedUrls(allPhotoPaths, 3600);
    for (const row of signed ?? []) {
      if (row.path && row.signedUrl) photoUrlMap.set(row.path, row.signedUrl);
    }
  }
  const logoUrl = logoPath ? (photoUrlMap.get(logoPath) ?? null) : null;
  const docUrlMap = new Map<string, string>();
  if (docPaths.length > 0) {
    const { data: signed } = await admin.storage
      .from('project-docs')
      .createSignedUrls(docPaths, 3600);
    for (const row of signed ?? []) {
      if (row.path && row.signedUrl) docUrlMap.set(row.path, row.signedUrl);
    }
  }

  // Group photos by tag for sectioned rendering.
  const photoBuckets = new Map<PortalPhotoTag, typeof snapshot.photos>();
  for (const photo of snapshot.photos) {
    for (const tag of photo.portal_tags) {
      const list = photoBuckets.get(tag) ?? [];
      list.push(photo);
      photoBuckets.set(tag, list);
    }
  }

  // Group photos by phase id (and a parallel index map for the
  // phases-list render below — older snapshots without phase ids on
  // their phase rows fall through to an empty bucket).
  const photosByPhaseId = new Map<string, typeof snapshot.photos>();
  for (const photo of snapshot.photos) {
    if (!photo.phase_id) continue;
    const list = photosByPhaseId.get(photo.phase_id) ?? [];
    list.push(photo);
    photosByPhaseId.set(photo.phase_id, list);
  }
  const phasePhotoBuckets = new Map<number, typeof snapshot.photos>();
  snapshot.phases.forEach((phase, idx) => {
    const id = (phase as { id?: string }).id;
    if (!id) return;
    const photos = photosByPhaseId.get(id);
    if (photos && photos.length > 0) phasePhotoBuckets.set(idx, photos);
  });

  // Group documents by type.
  const docBuckets = new Map<DocumentType, typeof snapshot.documents>();
  for (const doc of snapshot.documents) {
    const list = docBuckets.get(doc.type) ?? [];
    list.push(doc);
    docBuckets.set(doc.type, list);
  }

  // Group selections by room.
  const selectionsByRoom = new Map<string, typeof snapshot.selections>();
  for (const sel of snapshot.selections) {
    const room = sel.room.trim() || 'Unsorted';
    const list = selectionsByRoom.get(room) ?? [];
    list.push(sel);
    selectionsByRoom.set(room, list);
  }

  // The closeout narrative: the operator-approved Henry summary (rendered as
  // plain prose — Henry is invisible client-side) falls back to the operator's
  // typed project description. Split on blank lines into paragraphs.
  const summaryText = (snapshot.summary ?? snapshot.project.description ?? '').trim();
  const summaryParas = summaryText ? summaryText.split(/\n{2,}/).map((s) => s.trim()) : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <PublicViewLogger resourceType="property-record" identifier={slug} />

        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-10">
          {/* Letterhead — the GC's brand, rust the single accent */}
          <header className="grid gap-6 border-b border-brand pb-7 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <div className="flex h-12 max-w-[200px] items-center">
                    {/* biome-ignore lint/performance/noImgElement: signed URL bypasses next/image */}
                    <img
                      src={logoUrl}
                      alt={snapshot.contractor.name}
                      className="max-h-12 max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-base font-bold tracking-tight">{snapshot.contractor.name}</p>
                )}
              </div>
              <p className="mt-6 font-mono text-xs font-bold uppercase tracking-[0.18em] text-brand">
                Property Record
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {snapshot.project.name}
              </h1>
              {snapshot.customer.name ? (
                <p className="mt-3 text-sm text-foreground">
                  Prepared for <span className="font-semibold">{snapshot.customer.name}</span>
                  {snapshot.customer.address ? ` · ${snapshot.customer.address}` : null}
                </p>
              ) : null}
              <p className="mt-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {logoUrl ? '' : `Prepared by ${snapshot.contractor.name} · `}
                Generated {formatDate(snapshot.generated_at, tenantTz)}
              </p>
            </div>

            {hasPdf || hasZip ? (
              <div className="sm:text-right">
                <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Take this with you
                </p>
                <div className="flex flex-col gap-2 sm:min-w-[230px]">
                  {hasPdf ? (
                    <a
                      href={`/property-record/${slug}/download`}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90"
                    >
                      <Download className="size-4" aria-hidden />
                      Download PDF
                    </a>
                  ) : null}
                  {hasZip ? (
                    <a
                      href={`/property-record/${slug}/download-zip`}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-brand bg-card px-4 text-sm font-semibold text-brand hover:bg-paper-soft"
                    >
                      <Archive className="size-4" aria-hidden />
                      Download ZIP{' '}
                      <span className="font-mono text-xs uppercase opacity-80">Everything</span>
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </header>

          {/* Project summary — plain prose, no ✦ shown to the client */}
          {summaryParas.length > 0 ? (
            <Section eyebrow="Project summary" title="What we built together">
              <div className="max-w-[640px] space-y-3 text-base leading-relaxed text-foreground/90">
                {summaryParas.map((para) => (
                  <p key={para.slice(0, 32)}>{para}</p>
                ))}
              </div>
              {snapshot.project.start_date || snapshot.project.target_end_date ? (
                <p className="mt-4 font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {snapshot.project.start_date
                    ? `Started ${formatDate(snapshot.project.start_date, tenantTz)}`
                    : ''}
                  {snapshot.project.start_date && snapshot.project.target_end_date ? ' · ' : ''}
                  {snapshot.project.target_end_date
                    ? `Target ${formatDate(snapshot.project.target_end_date, tenantTz)}`
                    : ''}
                </p>
              ) : null}
            </Section>
          ) : null}

          {/* Phases — with inline photos for any phase that had pictures
              pinned. Status is text, never colour-only (WCAG SC 1.4.1). */}
          {snapshot.phases.length > 0 ? (
            <Section eyebrow="Project phases" title="How the work unfolded">
              <ol className="space-y-3">
                {snapshot.phases.map((phase, idx) => {
                  const phasePhotos = phasePhotoBuckets.get(idx) ?? [];
                  return (
                    <li key={phase.name}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{phase.name}</span>
                        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                          {phase.status === 'complete'
                            ? `Completed ${formatDate(phase.completed_at, tenantTz)}`
                            : phase.status === 'in_progress'
                              ? phase.started_at
                                ? `Started ${formatDate(phase.started_at, tenantTz)}`
                                : 'In progress'
                              : 'Upcoming'}
                        </span>
                      </div>
                      {phasePhotos.length > 0 ? (
                        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                          {phasePhotos.map((photo) => {
                            const url = photoUrlMap.get(photo.storage_path);
                            if (!url) return null;
                            return (
                              // biome-ignore lint/performance/noImgElement: signed URLs
                              <img
                                key={photo.id}
                                src={url}
                                alt={photo.caption ?? phase.name}
                                loading="lazy"
                                className="aspect-square rounded-lg border object-cover"
                              />
                            );
                          })}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </Section>
          ) : null}

          {/* Selections — grouped by room */}
          {selectionsByRoom.size > 0 ? (
            <Section eyebrow="What we used in your home" title="Materials & finishes by room">
              <div className="space-y-4">
                {Array.from(selectionsByRoom.entries()).map(([room, items]) => (
                  <div key={room} className="overflow-hidden rounded-lg border bg-card">
                    <h3 className="border-b bg-paper-soft px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-brand">
                      {room}
                    </h3>
                    <ul className="divide-y">
                      {items.map((sel) => {
                        const headline = [sel.brand, sel.name].filter(Boolean).join(' ');
                        const detail = [sel.code, sel.finish].filter(Boolean).join(' · ');
                        return (
                          <li
                            key={`${sel.room}-${sel.category}-${sel.name}-${sel.code}`}
                            className="px-4 py-3"
                          >
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wide">
                                {selectionCategoryLabels[sel.category as SelectionCategory] ??
                                  sel.category}
                              </span>
                              {headline ? (
                                <span className="text-sm font-semibold">{headline}</span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              {detail ? <span>{detail}</span> : null}
                              {sel.supplier ? <span>{sel.supplier}</span> : null}
                              {sel.sku ? <span>SKU {sel.sku}</span> : null}
                              {sel.warranty_url ? (
                                <a
                                  href={sel.warranty_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-brand hover:underline"
                                >
                                  Warranty info
                                </a>
                              ) : null}
                            </div>
                            {sel.notes ? (
                              <p className="mt-1 text-xs text-muted-foreground">{sel.notes}</p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Photos — by tag; behind-the-wall gets its own elevated section */}
          {snapshot.photos.length > 0 ? (
            <Section eyebrow="Photos" title="Through the project">
              <div className="space-y-6">
                {PORTAL_PHOTO_TAG_DISPLAY_ORDER.filter((tag) => tag !== 'behind_wall').map(
                  (tag) => {
                    const bucket = photoBuckets.get(tag) ?? [];
                    if (bucket.length === 0) return null;
                    return (
                      <div key={tag}>
                        <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wide text-foreground">
                          {portalPhotoTagLabels[tag]}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {bucket.length} {bucket.length === 1 ? 'photo' : 'photos'}
                          </span>
                        </h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                          {bucket.map((photo) => {
                            const url = photoUrlMap.get(photo.storage_path);
                            if (!url) return null;
                            return (
                              // biome-ignore lint/performance/noImgElement: signed URLs bypass next/image
                              <img
                                key={`${tag}-${photo.id}`}
                                src={url}
                                alt={photo.caption ?? portalPhotoTagLabels[tag]}
                                loading="lazy"
                                className="aspect-square w-full rounded-lg border object-cover"
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  },
                )}

                {/* Behind the wall — a signature value-prop, elevated */}
                {(photoBuckets.get('behind_wall') ?? []).length > 0 ? (
                  <div className="rounded-xl border border-brand/30 bg-paper-soft p-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <Layers className="size-4 text-brand" aria-hidden />
                      Behind the wall
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Useful for future repairs and resale — these show what&apos;s behind the
                      drywall so the next plumber, electrician, or buyer doesn&apos;t have to guess
                      where things run.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {(photoBuckets.get('behind_wall') ?? []).map((photo) => {
                        const url = photoUrlMap.get(photo.storage_path);
                        if (!url) return null;
                        return (
                          // biome-ignore lint/performance/noImgElement: signed URLs bypass next/image
                          <img
                            key={`behind_wall-${photo.id}`}
                            src={url}
                            alt={photo.caption ?? 'Behind the wall'}
                            loading="lazy"
                            className="aspect-square w-full rounded-lg border object-cover"
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </Section>
          ) : null}

          {/* Decisions */}
          {snapshot.decisions.length > 0 ? (
            <Section eyebrow="Decisions" title="Choices you made on this project">
              <ul className="space-y-2">
                {snapshot.decisions.map((d) => (
                  <li
                    key={`${d.label}-${d.decided_at ?? ''}`}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{d.label}</p>
                      {d.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{d.description}</p>
                      ) : null}
                      <p className="mt-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        {d.decided_by_customer ? `By ${d.decided_by_customer} · ` : ''}
                        {formatDate(d.decided_at, tenantTz)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wide',
                        d.decided_value === 'approved'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-border bg-muted text-muted-foreground',
                      )}
                    >
                      {d.decided_value === 'approved' ? 'Approved' : 'Declined'}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Change orders — the only money on the page (CAD cost impact only) */}
          {snapshot.change_orders.length > 0 ? (
            <Section eyebrow="Change orders" title="Approved adjustments">
              <ul className="space-y-2">
                {snapshot.change_orders.map((co) => (
                  <li
                    key={`${co.title}-${co.approved_at ?? ''}`}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-card p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{co.title}</p>
                      {co.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{co.description}</p>
                      ) : null}
                      <p className="mt-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        Approved
                        {co.approved_by_name ? ` by ${co.approved_by_name}` : ''}
                        {co.approved_at ? ` · ${formatDate(co.approved_at, tenantTz)}` : ''}
                        {co.timeline_impact_days ? ` · +${co.timeline_impact_days} days` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold tabular-nums">
                        {cadFormat.format((co.cost_impact_cents ?? 0) / 100)}
                      </p>
                      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        CAD
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Documents — grouped by type */}
          {snapshot.documents.length > 0 ? (
            <Section eyebrow="Documents & warranties" title="Files we kept for you">
              <div className="space-y-4">
                {DOCUMENT_TYPE_DISPLAY_ORDER.map((type) => {
                  const docs = docBuckets.get(type) ?? [];
                  if (docs.length === 0) return null;
                  return (
                    <div key={type} className="overflow-hidden rounded-lg border bg-card">
                      <h3 className="flex items-baseline gap-2 border-b bg-paper-soft px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-foreground">
                        {documentTypeLabels[type]}
                        <span className="font-normal text-muted-foreground">
                          {docs.length} {docs.length === 1 ? 'file' : 'files'}
                        </span>
                      </h3>
                      <ul className="divide-y">
                        {docs.map((d) => {
                          const url = docUrlMap.get(d.storage_path);
                          const inner = (
                            <>
                              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                                <FileText className="size-4" aria-hidden />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{d.title}</p>
                                {d.expires_at ? (
                                  <p className="text-xs text-muted-foreground">
                                    Expires {formatDate(d.expires_at, tenantTz)}
                                  </p>
                                ) : null}
                              </div>
                            </>
                          );
                          return url ? (
                            <li key={d.storage_path}>
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 px-4 py-3 hover:bg-paper-soft"
                              >
                                {inner}
                                <ExternalLink
                                  className="size-4 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                              </a>
                            </li>
                          ) : (
                            <li key={d.storage_path} className="flex items-center gap-3 px-4 py-3">
                              {inner}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Section>
          ) : null}

          {/* Footer — "save this link" + the only HeyHenry mark on the page */}
          <footer className="mt-10 flex flex-wrap items-end justify-between gap-3 border-t border-brand pt-6 text-xs text-muted-foreground">
            <p>
              A permanent record from{' '}
              <span className="font-semibold text-foreground">{snapshot.contractor.name}</span>.
              Save this link — it works forever.
            </p>
            <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground/70">
              Powered by <span className="font-semibold text-muted-foreground">HeyHenry</span>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 border-t border-brand pt-8">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-brand">
        {eyebrow}
      </p>
      <h2 className="mb-4 mt-1 text-xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
