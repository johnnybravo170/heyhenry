-- Migration 0034: Three features
--   1. Change orders on jobs (add job_id FK, relax project_id NOT NULL)
--   2. Photo 'concern' tag
--   3. Invoice line_items JSONB + customer_note

-- ── 1. Change orders on jobs ────────────────────────────────────────────

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE;

-- project_id was NOT NULL; now either project_id or job_id must be set
ALTER TABLE public.change_orders
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_scope_check
  CHECK (project_id IS NOT NULL OR job_id IS NOT NULL);

-- ── 2. Photo 'concern' tag ──────────────────────────────────────────────

ALTER TABLE public.photos
  DROP CONSTRAINT IF EXISTS photos_tag_check;

ALTER TABLE public.photos
  ADD CONSTRAINT photos_tag_check
  CHECK (tag IN ('before', 'after', 'progress', 'other', 'concern'));

-- ── 3. Invoice line items + customer note ───────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_note TEXT,
  ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]';
