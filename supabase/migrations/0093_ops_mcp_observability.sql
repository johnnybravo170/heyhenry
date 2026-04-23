-- 0093_ops_mcp_observability.sql
-- Per-token MCP observability: track last-use, enforce per-minute rate limits.
--
-- Adds last_used_at to ops.oauth_tokens so the admin UI can show when each
-- bearer was last seen, plus a tiny per-minute rolling counter table used by
-- ops/src/lib/mcp-rate-limit.ts.
--
-- Both objects are service-role only (RLS enabled, no policies). The counter
-- table is best-effort cleaned by the helper (rows older than 5 min).

-- audit_log.key_id used to FK to ops.api_keys, but now we also stamp OAuth
-- token ids (from ops.oauth_tokens) into it for MCP requests. Drop the FK so
-- both kinds of UUIDs are allowed; the column remains a plain reference.
ALTER TABLE ops.audit_log DROP CONSTRAINT IF EXISTS audit_log_key_id_fkey;

ALTER TABLE ops.oauth_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS ops_oauth_tokens_last_used_idx
  ON ops.oauth_tokens (last_used_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS ops.mcp_rate_counters (
  token_id       UUID NOT NULL REFERENCES ops.oauth_tokens(id) ON DELETE CASCADE,
  minute_bucket  TIMESTAMPTZ NOT NULL,
  count          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (token_id, minute_bucket)
);

CREATE INDEX IF NOT EXISTS ops_mcp_rate_counters_bucket_idx
  ON ops.mcp_rate_counters (minute_bucket);

ALTER TABLE ops.mcp_rate_counters ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only.

-- Atomic increment-and-return helper. Bumps the per-(token, minute) counter
-- and returns the new value so the caller can decide whether to 429.
CREATE OR REPLACE FUNCTION ops.bump_mcp_rate_counter(p_token_id UUID, p_bucket TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ops, pg_temp
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO ops.mcp_rate_counters (token_id, minute_bucket, count)
  VALUES (p_token_id, p_bucket, 1)
  ON CONFLICT (token_id, minute_bucket)
    DO UPDATE SET count = ops.mcp_rate_counters.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;
