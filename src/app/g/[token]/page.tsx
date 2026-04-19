/**
 * Public photo gallery — the landing page for the share link in every
 * closeout email. No auth required; token is the access control.
 *
 * Phase 3 scope: job-full galleries only. Other scope_types (album,
 * pair_set, single) are wired in later phases.
 */

import { ImageOff } from 'lucide-react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { loadGalleryForJob } from '@/lib/photos/gallery-query';
import { lookupShareLink, recordShareLinkView } from '@/lib/photos/share-links';

export const dynamic = 'force-dynamic';

const TAG_LABEL: Record<string, string> = {
  before: 'Before',
  after: 'After',
  progress: 'Progress',
  damage: 'Noted',
  other: 'Other',
};

export default async function PublicGalleryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await lookupShareLink(token);
  if (!link) notFound();

  // Phase 3: only job_full is supported. Other scopes fall through to 404
  // rather than quietly misbehave.
  if (link.scopeType !== 'job_full') notFound();

  const reqHeaders = await headers();
  const clientIp =
    reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? reqHeaders.get('x-real-ip') ?? null;
  // Fire and forget — don't block render on view tracking.
  void recordShareLinkView(token, clientIp);

  const data = await loadGalleryForJob({ tenantId: link.tenantId, jobId: link.scopeId });
  if (!data) notFound();

  const groups = groupByTag(data.photos);
  const orderedTags: Array<keyof typeof TAG_LABEL> = [
    'before',
    'after',
    'progress',
    'damage',
    'other',
  ];

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Job gallery
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {data.jobLabel ? `${data.jobLabel} · ${data.tenantName}` : data.tenantName}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every photo is timestamped and kept on file by {data.tenantName}.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {data.photos.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center text-neutral-500">
            Photos will appear here as they're captured on the job.
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {orderedTags.map((tag) => {
              const items = groups.get(tag);
              if (!items || items.length === 0) return null;
              return (
                <section key={tag}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                    {TAG_LABEL[tag]}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {items.map((photo) => (
                      <figure key={photo.id} className="overflow-hidden rounded-xl border bg-white">
                        <div className="aspect-square w-full bg-neutral-100">
                          {photo.url ? (
                            // biome-ignore lint/performance/noImgElement: signed URLs bypass next/image optimizer
                            <img
                              src={photo.url}
                              alt={photo.caption ?? TAG_LABEL[tag] ?? 'Photo'}
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-neutral-400">
                              <ImageOff className="size-6" aria-hidden />
                            </div>
                          )}
                        </div>
                        {photo.caption ? (
                          <figcaption className="border-t px-3 py-2 text-xs text-neutral-600">
                            {photo.caption}
                          </figcaption>
                        ) : null}
                      </figure>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <footer className="mx-auto max-w-5xl px-6 pb-12 pt-4 text-center text-xs text-neutral-500">
        Shared by {data.tenantName} via Hey Henry
      </footer>
    </main>
  );
}

function groupByTag<T extends { tag: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const arr = map.get(item.tag) ?? [];
    arr.push(item);
    map.set(item.tag, arr);
  }
  return map;
}
