CREATE TABLE IF NOT EXISTS ops.git_daily_stats (
  day             DATE PRIMARY KEY,
  commit_count    INT  NOT NULL DEFAULT 0,
  loc_added       INT  NOT NULL DEFAULT 0,
  loc_deleted     INT  NOT NULL DEFAULT 0,
  contributors    TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  last_refreshed  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ops.git_daily_stats ENABLE ROW LEVEL SECURITY;
-- no policies; service-role only
