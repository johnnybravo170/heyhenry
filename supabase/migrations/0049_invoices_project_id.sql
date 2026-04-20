-- Add project_id to invoices so GC projects can have milestone / estimate
-- invoices tied to a project (not just a pressure-washing job).

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_project_id
  ON public.invoices (project_id)
  WHERE project_id IS NOT NULL;

-- Relax job_id so project-based invoices don't need one.
ALTER TABLE public.invoices
  ALTER COLUMN job_id DROP NOT NULL;

-- Either job_id or project_id must be set.
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_job_or_project_required;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_job_or_project_required
  CHECK (job_id IS NOT NULL OR project_id IS NOT NULL);
