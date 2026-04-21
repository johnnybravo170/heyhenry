-- 0068_ops_roadmap.sql
-- Roadmap module. Cards across five lanes (product / marketing / ops / sales
-- / research), five statuses (backlog / up_next / in_progress / done / archived).
-- source_idea_id preserves the link when a card was promoted from an idea.

CREATE TABLE IF NOT EXISTS ops.roadmap_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type        TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name        TEXT NOT NULL,
  key_id            UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lane              TEXT NOT NULL
                    CHECK (lane IN ('product', 'marketing', 'ops', 'sales', 'research')),
  status            TEXT NOT NULL DEFAULT 'backlog'
                    CHECK (status IN ('backlog', 'up_next', 'in_progress', 'done', 'archived')),
  priority          SMALLINT CHECK (priority IS NULL OR (priority BETWEEN 1 AND 5)),
  title             TEXT NOT NULL,
  body              TEXT,
  assignee          TEXT,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  source_idea_id    UUID REFERENCES ops.ideas(id) ON DELETE SET NULL,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_roadmap_lane_status_idx
  ON ops.roadmap_items (lane, status, status_changed_at DESC)
  WHERE status <> 'archived';

CREATE INDEX IF NOT EXISTS ops_roadmap_source_idea_idx
  ON ops.roadmap_items (source_idea_id) WHERE source_idea_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ops.roadmap_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES ops.roadmap_items(id) ON DELETE CASCADE,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name    TEXT NOT NULL,
  key_id        UUID REFERENCES ops.api_keys(id) ON DELETE SET NULL,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_roadmap_comments_item_idx
  ON ops.roadmap_comments (item_id, created_at);

-- Append-only activity log for status transitions + assignments so the card
-- detail page can show a real timeline.
CREATE TABLE IF NOT EXISTS ops.roadmap_activity (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES ops.roadmap_items(id) ON DELETE CASCADE,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_name    TEXT NOT NULL,
  kind          TEXT NOT NULL
                CHECK (kind IN ('created', 'status_changed', 'assigned', 'priority_changed', 'promoted_from_idea')),
  from_value    TEXT,
  to_value      TEXT,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_roadmap_activity_item_idx
  ON ops.roadmap_activity (item_id, created_at);

ALTER TABLE ops.roadmap_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.roadmap_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.roadmap_activity  ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ops.roadmap_items, ops.roadmap_comments, ops.roadmap_activity
  TO service_role;
