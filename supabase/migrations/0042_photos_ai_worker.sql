-- 0042_photos_ai_worker.sql
-- Support columns for the async AI classification worker (Phase 2 of
-- PHOTOS_PLAN.md). Pattern:
--   - Worker claims photos where ai_processed_at IS NULL AND ai_attempts < 3
--   - On start of processing: ai_attempts incremented
--   - On success: ai_processed_at set (and ai_tag / ai_caption populated)
--   - On failure: ai_last_error written, ai_attempts stays incremented
--   - After 3 failures, worker leaves the photo alone; operator can manually
--     reset by setting ai_attempts back to 0.

ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_attempts SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_last_error TEXT;

-- Hot index for the worker's claim query.
CREATE INDEX IF NOT EXISTS photos_ai_worker_claim_idx
  ON public.photos (created_at)
  WHERE ai_processed_at IS NULL AND ai_attempts < 3 AND deleted_at IS NULL;
