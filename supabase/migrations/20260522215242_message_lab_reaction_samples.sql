-- Message Lab multi-sample: each archetype now reacts N times (default 3)
-- so a single noisy coin-flip doesn't decide its verdict. We record how many
-- samples parsed and how many leaned buy, so the UI/MCP can show a per-archetype
-- LEAN ("2/3 buy") instead of a hard yes/no, and parse failures are excluded
-- from the denominator rather than miscounted as no_buy.

ALTER TABLE ops.message_eval_reactions
  ADD COLUMN IF NOT EXISTS sample_count INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS buy_votes    INT NOT NULL DEFAULT 0;
