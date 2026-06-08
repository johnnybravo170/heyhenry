-- Register the Command Center Dispatch executor routine in the agents registry.
-- It claims cc:autoship todo cards (low-blast, human-decided) on the Dev board
-- and opens one PR each (never merges). Source: ROUTINES/command-center-dispatch.md.
-- Idempotent — re-applying updates the row in place.
INSERT INTO ops.agents (slug, name, description, agent_type, schedule, owner, status, expected_max_gap_minutes, tags)
VALUES (
  'command-center-dispatch',
  'Command Center Dispatch',
  'Turns Command Center decisions into shipped work: claims cc:autoship todo cards on the Dev board (low-blast, human-decided) and opens a PR for each — never merges. Re-confirms the blast-radius gate before building; propose-mode default, honors ship_lane.auto_ship_mode; cap 3/run, one card = one PR. Source: ROUTINES/command-center-dispatch.md.',
  'routine',
  'Remote (cloud); polled a few times daily',
  'jonathan',
  'active',
  1440,
  ARRAY['command-center', 'dispatch', 'auto-ship', 'agent-pipelines']
)
ON CONFLICT (slug) DO UPDATE SET
  name                     = EXCLUDED.name,
  description              = EXCLUDED.description,
  agent_type               = EXCLUDED.agent_type,
  schedule                 = EXCLUDED.schedule,
  owner                    = EXCLUDED.owner,
  status                   = EXCLUDED.status,
  expected_max_gap_minutes = EXCLUDED.expected_max_gap_minutes,
  tags                     = EXCLUDED.tags,
  updated_at               = now();
