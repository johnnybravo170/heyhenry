-- 0130_photos_phase_link.sql
-- Slice 1 polish — phase photos.
--
-- Lets the operator attach a photo to a specific project phase so the
-- homeowner sees photos inline on the timeline (NOT just bucketed by
-- portal_tags). Nullable: photos without a phase still belong to the
-- gallery and behave exactly as before.
--
-- ON DELETE SET NULL so deleting a phase doesn't orphan or destroy
-- photos — they fall back to "no phase" and stay in the gallery.

ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS phase_id UUID
    REFERENCES public.project_phases (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_photos_phase
  ON public.photos (phase_id, taken_at DESC NULLS LAST)
  WHERE phase_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.photos.phase_id IS
  'Optional link to a project phase so the photo appears inline on the homeowner-facing timeline. Nullable; photos without a phase still show in the regular gallery.';
