/**
 * Server component wrapper — checks for before/after photos before
 * rendering the client-side SocialPostGenerator.
 *
 * Only renders if the job has at least one "before" and one "after" photo.
 */

import { listPhotosByJob } from '@/lib/db/queries/photos';
import { SocialPostGenerator } from './social-post-generator';

type SocialPostSectionProps = {
  jobId: string;
  businessName: string;
};

export async function SocialPostSection({ jobId, businessName }: SocialPostSectionProps) {
  const photos = await listPhotosByJob(jobId);
  const hasBefore = photos.some((p) => p.tag === 'before');
  const hasAfter = photos.some((p) => p.tag === 'after');

  if (!hasBefore || !hasAfter) return null;

  return <SocialPostGenerator jobId={jobId} businessName={businessName} />;
}
