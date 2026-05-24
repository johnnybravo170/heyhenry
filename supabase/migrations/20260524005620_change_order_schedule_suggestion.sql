-- 20260524005620_change_order_schedule_suggestion
--
-- CO → schedule embedded-Henry touchpoint (Schedule brief §"Henry
-- intelligence touchpoints" #3, vault gotcha #13: change orders are not
-- linked to the Gantt).
--
-- When a change order is approved, Henry offers an inline prompt on the
-- Schedule tab to draft schedule task(s) for the newly-added scope. The
-- prompt is derived from change_orders state (approved + this column
-- null), so it needs a project-scoped, shared-across-operators dedup
-- marker: once an operator accepts the draft OR dismisses the prompt,
-- this stamp is set and the CO stops re-nagging on every tab load.
--
-- Nullable + no default: existing approved COs surface their prompt once
-- (operators dismiss or act). No backfill — a fresh approved CO with a
-- null stamp is exactly the "needs scheduling" signal.

BEGIN;

ALTER TABLE public.change_orders
  ADD COLUMN schedule_suggestion_dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.change_orders.schedule_suggestion_dismissed_at IS
  'Set when the operator accepts the CO→schedule draft or dismisses the inline Schedule-tab prompt. Null = the approved CO still surfaces its "add to schedule?" prompt.';

COMMIT;
