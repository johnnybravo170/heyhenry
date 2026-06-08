-- 20260603153851_drop_remaining_ops_key_id_fks.sql
-- Continuation of 0094_drop_ops_key_id_fks. That sweep dropped the
-- key_id -> ops.api_keys FK from every ops resource table that existed at
-- the time. Five tables created AFTER 0094 re-introduced the same FK from
-- the old template:
--   board_sessions, decision_bundles, idea_outcomes, message_evals, scout_policy.
--
-- Under OAuth-authed MCP calls (Claude Code Routines), ctx.keyId is the
-- ops.oauth_tokens UUID, which isn't in ops.api_keys -> every INSERT that
-- stamps key_id FK-violates. This silently bricked the Command Center queue
-- (decision_bundles) for 8 days: the daily digest's drafts all 500'd while
-- audit logging (no FK) and update-in-place (doesn't touch key_id) masked it.
--
-- key_id is polymorphic actor attribution (api_keys.id OR oauth_tokens.id),
-- exactly like audit_log.key_id, which carries no FK by design. Drop the
-- single-target FK; the column stays.

ALTER TABLE ops.board_sessions   DROP CONSTRAINT IF EXISTS board_sessions_created_by_key_id_fkey;
ALTER TABLE ops.decision_bundles DROP CONSTRAINT IF EXISTS decision_bundles_key_id_fkey;
ALTER TABLE ops.idea_outcomes    DROP CONSTRAINT IF EXISTS idea_outcomes_key_id_fkey;
ALTER TABLE ops.message_evals    DROP CONSTRAINT IF EXISTS message_evals_created_by_key_id_fkey;
ALTER TABLE ops.scout_policy     DROP CONSTRAINT IF EXISTS scout_policy_key_id_fkey;
