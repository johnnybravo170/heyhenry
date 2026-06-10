-- GC-managed workers: allow worker_profiles to exist without an app account.
-- A GC can add a crew member by name — no invite link, no login required.
-- Workers who only show up for a job or two never need the app.
--
-- If the worker later signs up via a separate invite, the GC can link their
-- existing profile to the new tenant_member manually (future "Link account" flow).

-- 1. Drop NOT NULL on tenant_member_id so profiles can exist without a linked account.
ALTER TABLE public.worker_profiles
  ALTER COLUMN tenant_member_id DROP NOT NULL;

-- 2. Name for GC-side-only profiles (no tenant_member to pull a name from).
ALTER TABLE public.worker_profiles
  ADD COLUMN gc_managed_name TEXT;

-- 3. Every profile must have at least one identity anchor.
ALTER TABLE public.worker_profiles
  ADD CONSTRAINT worker_profiles_identity_required
  CHECK (tenant_member_id IS NOT NULL OR gc_managed_name IS NOT NULL);
