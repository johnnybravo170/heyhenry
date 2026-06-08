-- First-run onboarding progress marker on tenants.
--
-- Additive + non-destructive. Two nullable columns track where a freshly
-- signed-up owner is in the skippable/resumable first-run setup pass
-- (/onboarding):
--
--   onboarding_step          — furthest step the owner has reached (0-based;
--                              0 = vertical, 1 = business profile, 2 = meet
--                              Henry). Drives "resume to furthest-incomplete
--                              step". Defaults to 0 so a new signup starts at
--                              the top of the flow.
--   onboarding_completed_at  — stamped when the owner finishes (or skips
--                              through) the pass. NULL = still in setup.
--                              Once set, /onboarding redirects to /dashboard.
--
-- CRITICAL: existing tenants must NOT get dragged into onboarding. They
-- predate this flow and have already done their first run on the dashboard.
-- We backfill every existing row with onboarding_completed_at = now() so the
-- /onboarding guard treats them as complete. New signups insert with the
-- column NULL (no default on completed_at) → they enter the flow.
--
-- No RLS / access change: these columns sit on `tenants`, already covered by
-- the tenant's existing row-level policies. Nothing reads them cross-tenant.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Backfill: every tenant that already exists is "complete" — they never saw
-- this flow and shouldn't start it now. Only rows where completed_at is still
-- NULL are touched (idempotent re-run safe).
UPDATE public.tenants
  SET onboarding_completed_at = now()
  WHERE onboarding_completed_at IS NULL;

COMMENT ON COLUMN public.tenants.onboarding_step IS
  'Furthest first-run setup step reached (0=vertical, 1=profile, 2=meet-henry). Resume marker for /onboarding.';
COMMENT ON COLUMN public.tenants.onboarding_completed_at IS
  'When the owner finished or skipped through the first-run setup pass. NULL = still in /onboarding.';
