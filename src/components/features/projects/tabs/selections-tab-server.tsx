import { SelectionFormDialog } from '@/components/features/portal/selection-form-dialog';
import { SelectionList } from '@/components/features/portal/selection-list';
import type { GalleryPickerPhoto } from '@/components/features/portal/selection-photo-picker';
import { listPhotosByProject } from '@/lib/db/queries/photos';
import {
  groupSelectionsByRoom,
  listSelectionsForProject,
} from '@/lib/db/queries/project-selections';

export default async function SelectionsTabServer({ projectId }: { projectId: string }) {
  const [selections, photos] = await Promise.all([
    listSelectionsForProject(projectId),
    listPhotosByProject(projectId),
  ]);
  const groups = groupSelectionsByRoom(selections);

  // Pre-resolved signed URLs from listPhotosByProject — pass to the
  // photo-refs picker dialog. Filter to photos that have a signed URL
  // and belong to this project (project_id matches; deleted_at filters
  // already applied upstream).
  const galleryPhotos: GalleryPickerPhoto[] = photos
    .filter((p) => Boolean(p.url))
    .map((p) => ({
      id: p.id,
      storage_path: p.storage_path,
      url: p.url as string,
      caption: p.caption ?? null,
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Selections</h2>
          <p className="text-sm text-muted-foreground">
            Per-room paint codes, tile, fixtures, hardware. The homeowner sees these on their portal
            and they get rolled into the final Home Record.
          </p>
        </div>
        <SelectionFormDialog projectId={projectId} />
      </div>
      <SelectionList groups={groups} projectId={projectId} galleryPhotos={galleryPhotos} />
    </div>
  );
}
