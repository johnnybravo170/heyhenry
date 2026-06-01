-- 20260601180241_ideas_review_drift_cap.sql
-- Drift cap for the snooze-review cron.
--
-- A `not_yet` verdict re-snoozes an idea with no bound, so a condition that
-- never comes true loops forever — never actioned, never dismissed. Track a
-- re-snooze counter; after MAX_RESNOOZE_COUNT (4, in the cron) consecutive
-- re-snoozes the cron parks the idea in a new terminal `stalled` state and
-- escalates to Jonathan once for a manual call, instead of looping again.
--
-- Distinct from review_attempt_count (error backoff). resnooze_count resets
-- when the idea is actioned, dismissed, or re-snoozed afresh via ideas_snooze
-- (a revised condition/date is a new bet, and re-pending pulls a stalled idea
-- back into the review pool).
--
-- Additive: nullable-free column with a default, and the CHECK is widened to a
-- superset, so every existing row stays valid and code already live is
-- unaffected during the deploy window.

ALTER TABLE ops.ideas
  ADD COLUMN IF NOT EXISTS resnooze_count INTEGER NOT NULL DEFAULT 0;

-- Widen the review_status state machine to include 'stalled'. The original
-- constraint (migration 0205) was an inline column CHECK, auto-named
-- ops.ideas_review_status_check by Postgres.
ALTER TABLE ops.ideas DROP CONSTRAINT IF EXISTS ideas_review_status_check;
ALTER TABLE ops.ideas ADD CONSTRAINT ideas_review_status_check
  CHECK (review_status IN (
    'pending', 'reviewing', 'actioned', 're_snoozed', 'dismissed', 'errored', 'stalled'
  ));

COMMENT ON COLUMN ops.ideas.resnooze_count IS
  'Consecutive not_yet re-snoozes by the review cron. At the cron''s cap (MAX_RESNOOZE_COUNT) the idea is parked in review_status=stalled and escalated once. Resets to 0 on actioned/dismissed or a fresh ideas_snooze.';
