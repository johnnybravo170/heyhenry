-- Link worker_profiles to a contacts card.
--
-- When a worker joins via any of the three acceptance paths (new signup,
-- existing-account login, session join), a contacts row is auto-created
-- and this FK is set. Workers who joined before this migration get a
-- contact card created lazily on the next team-page load (same pattern
-- as the existing worker_profiles auto-create in listTeamMembers).
--
-- ON DELETE SET NULL: deleting a contact card does not remove the worker.

ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS contact_id UUID
    REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_worker_profiles_contact
  ON public.worker_profiles (contact_id)
  WHERE contact_id IS NOT NULL;
