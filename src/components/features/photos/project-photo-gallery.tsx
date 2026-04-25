/**
 * Project-scoped photo gallery — server component.
 *
 * Mirrors PhotoGallery but queries by project_id. Renders the
 * ProjectPhotoBulkBar client wrapper which owns the selection state
 * and the bulk-action toolbar; PhotoCard remains the per-photo render.
 */

import { ImagePlus } from 'lucide-react';
import { listPhotosByProject, listTenantJobTypes } from '@/lib/db/queries/photos';
import { listPhasesForProject } from '@/lib/db/queries/project-phases';
import { ProjectPhotoBulkBar } from './project-photo-bulk-bar';

export async function ProjectPhotoGallery({
  projectId,
  tenantId,
}: {
  projectId: string;
  tenantId: string;
}) {
  const [photos, tenantJobTypes, phaseRows] = await Promise.all([
    listPhotosByProject(projectId),
    listTenantJobTypes(tenantId),
    listPhasesForProject(projectId),
  ]);
  const phases = phaseRows.map((p) => ({ id: p.id, name: p.name }));

  if (photos.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-8 text-center"
        data-slot="project-photo-gallery-empty"
      >
        <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">No photos for this project yet.</p>
        <p className="text-xs text-muted-foreground">Upload some above to get started.</p>
      </div>
    );
  }

  return (
    <ProjectPhotoBulkBar
      photos={photos}
      tenantJobTypes={tenantJobTypes}
      phases={phases}
      projectId={projectId}
    />
  );
}
