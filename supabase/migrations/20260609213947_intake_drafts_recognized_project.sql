-- Tentative project match on intake_drafts — mirrors recognized_customer_id.
--
-- recognized_project_id: the project Henry matched from the inbound email
-- subject / body text. Set automatically during email processing; the
-- operator can accept, override, or ignore it in the action dialogs.
-- NULL until a match is found; stays NULL for non-email sources.
--
-- Additive + nullable; intake_drafts already has its RLS + grants.

ALTER TABLE public.intake_drafts
  ADD COLUMN IF NOT EXISTS recognized_project_id UUID
    REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_intake_drafts_recognized_project
  ON public.intake_drafts (recognized_project_id)
  WHERE recognized_project_id IS NOT NULL;
