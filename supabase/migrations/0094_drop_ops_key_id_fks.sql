-- 0094_drop_ops_key_id_fks.sql
-- Sibling to 0093 (which dropped audit_log.key_id → api_keys). Every other
-- ops resource table also has a key_id column FK'd to ops.api_keys. When
-- the MCP endpoint runs under OAuth, ctx.keyId is the oauth_tokens UUID,
-- which isn't in api_keys → inserts FK-violate. Drop the constraints so
-- key_id can hold UUIDs from either ops.api_keys or ops.oauth_tokens.
-- The column stays (still useful for actor attribution).

ALTER TABLE ops.rate_limit_events DROP CONSTRAINT IF EXISTS rate_limit_events_key_id_fkey;
ALTER TABLE ops.worklog_entries   DROP CONSTRAINT IF EXISTS worklog_entries_key_id_fkey;
ALTER TABLE ops.ideas             DROP CONSTRAINT IF EXISTS ideas_key_id_fkey;
ALTER TABLE ops.idea_comments     DROP CONSTRAINT IF EXISTS idea_comments_key_id_fkey;
ALTER TABLE ops.roadmap_items     DROP CONSTRAINT IF EXISTS roadmap_items_key_id_fkey;
ALTER TABLE ops.roadmap_comments  DROP CONSTRAINT IF EXISTS roadmap_comments_key_id_fkey;
ALTER TABLE ops.decisions         DROP CONSTRAINT IF EXISTS decisions_key_id_fkey;
ALTER TABLE ops.decision_comments DROP CONSTRAINT IF EXISTS decision_comments_key_id_fkey;
ALTER TABLE ops.knowledge_docs    DROP CONSTRAINT IF EXISTS knowledge_docs_key_id_fkey;
ALTER TABLE ops.competitors       DROP CONSTRAINT IF EXISTS competitors_key_id_fkey;
ALTER TABLE ops.incidents         DROP CONSTRAINT IF EXISTS incidents_key_id_fkey;
ALTER TABLE ops.social_drafts     DROP CONSTRAINT IF EXISTS social_drafts_key_id_fkey;
ALTER TABLE ops.docs              DROP CONSTRAINT IF EXISTS docs_key_id_fkey;
