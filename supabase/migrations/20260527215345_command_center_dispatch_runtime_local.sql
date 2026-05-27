-- Correct the command-center-dispatch registration: it runs as a LOCAL
-- Claude Code session on a /loop poll during work hours (in a dedicated
-- worktree), NOT a Remote cloud routine — local gets real git/gh for PRs and
-- sidesteps the 15/day Remote cap. Forward-only fix to 20260527214244.
UPDATE ops.agents
   SET schedule                 = 'Local Claude Code session — /loop ~30min during work hours, dedicated worktree (pauses when closed)',
       expected_max_gap_minutes = 4320,  -- only runs while Jonathan is at the machine; don't flag stale over nights/weekends
       tags                     = ARRAY['command-center', 'dispatch', 'auto-ship', 'agent-pipelines', 'local'],
       updated_at               = now()
 WHERE slug = 'command-center-dispatch';
