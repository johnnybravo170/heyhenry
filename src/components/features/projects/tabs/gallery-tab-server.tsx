import { OfflineCaptureQueue } from '@/components/features/photos/offline-capture-queue';
import { PhotoUpload } from '@/components/features/photos/photo-upload';
import { ProjectPhotoGallery } from '@/components/features/photos/project-photo-gallery';
import { getProject } from '@/lib/db/queries/projects';

export default async function GalleryTabServer({ projectId }: { projectId: string }) {
  const project = await getProject(projectId);
  if (!project) return null;

  return (
    <div className="space-y-6">
      <PhotoUpload projectId={projectId} />
      {/* Field-reality: offline captures queue locally + sync on reconnect.
          Renders nothing when online with an empty queue. */}
      <OfflineCaptureQueue projectId={projectId} />
      <ProjectPhotoGallery projectId={projectId} tenantId={project.tenant_id} />
    </div>
  );
}
