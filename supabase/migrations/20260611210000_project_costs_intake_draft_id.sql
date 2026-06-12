-- Track which intake_draft spawned a project_costs row. Used for:
--   1. Undo — delete ALL split rows from one receipt in one query
--      (applied_destination_id points to only the first split; this
--      column lets undoIntakeApplyAction find the rest).
--   2. Audit — trace any cost row back to its original inbox item.
-- Nullable: existing rows (manual entry, non-intake receipts) have no draft.
ALTER TABLE public.project_costs
  ADD COLUMN IF NOT EXISTS intake_draft_id uuid
    REFERENCES public.intake_drafts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_costs_intake_draft_id
  ON public.project_costs (intake_draft_id)
  WHERE intake_draft_id IS NOT NULL;
