-- 20260601172825_ideas_review_criterion.sql
-- Snooze stores a DATE but never the CONDITION it's waiting on.
--
-- The review cron (api/ops/ideas-review/run) re-evaluates a snoozed idea on
-- its remind_at by asking Sonnet "is this actionable now?" against a generic
-- business snapshot — with no memory of WHY it was snoozed. With nothing
-- concrete to test, the safe completion is "not_yet, re-snooze again", so
-- ideas drift indefinitely and the verdicts read as a restatement of current
-- priorities rather than a real check.
--
-- Capture the unblock condition as free text at snooze time. The cron then
-- judges the specific question "has THIS condition become true?" instead of
-- the vibe question "does this align with priorities?". remind_at demotes
-- from trigger to polling cadence.
--
-- Additive + nullable: legacy snoozed rows (criterion IS NULL) keep the old
-- prompt path in the cron, so this is backward-compatible with code already
-- live during the deploy window.

ALTER TABLE ops.ideas
  ADD COLUMN IF NOT EXISTS review_criterion TEXT;

COMMENT ON COLUMN ops.ideas.review_criterion IS
  'The unblock condition this snooze is waiting on, captured at snooze time via ideas_snooze (e.g. "after JVD week-1 activation is confirmed"). The review cron judges whether THIS condition is now met, rather than generic priority-alignment. NULL = legacy snooze (pre-criterion); cron falls back to the old "actionable now?" prompt.';
