-- 20260526031217_decision_bundles_visual.sql
-- Visual-QA support for the Command Center queue (kanban 4f09f9fc).
--
-- The Hermes Visual-QA Loop (vault spec 99955350) feeds render-defect findings
-- into the Command Center. A finding that needs Jonathan's eye ([surface]) is
-- a decision bundle in a new "visual" bucket carrying before/after screenshots
-- + a plain-English caption, so /admin/queue can render an image card instead
-- of the text/decision layout the other streams use.

ALTER TABLE ops.decision_bundles
  DROP CONSTRAINT IF EXISTS decision_bundles_bucket_check;

ALTER TABLE ops.decision_bundles
  ADD CONSTRAINT decision_bundles_bucket_check
  CHECK (bucket IN ('decision', 'research', 'go_nogo', 'grooming', 'visual'));

ALTER TABLE ops.decision_bundles
  ADD COLUMN IF NOT EXISTS before_image_url TEXT,
  ADD COLUMN IF NOT EXISTS after_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS image_caption    TEXT;

COMMENT ON COLUMN ops.decision_bundles.before_image_url IS
  'Visual-QA: screenshot of the defect (detector before-shot). Rendered as an image card in /admin/queue when present.';
COMMENT ON COLUMN ops.decision_bundles.after_image_url IS
  'Visual-QA: screenshot after an attempted fix (fixer after-shot), if any.';
