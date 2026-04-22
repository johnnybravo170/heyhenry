-- ============================================================
-- 0076_project_notes.sql
--
-- Two changes for the unified project Notes feed:
--
-- 1. Allow related_type='project' on worklog_entries so intake events,
--    Henry observations, and system events can scope to a project.
--    The original CHECK only allowed customer/quote/job/invoice.
--
-- 2. Add a project_notes table for plain text notes the operator
--    types directly. Memos (audio) stay in project_memos. The Notes
--    tab merges all three sources chronologically.
-- ============================================================

-- 1. Loosen worklog_entries.related_type
ALTER TABLE public.worklog_entries
  DROP CONSTRAINT IF EXISTS worklog_entries_related_type_check;
ALTER TABLE public.worklog_entries
  ADD  CONSTRAINT worklog_entries_related_type_check
  CHECK (related_type IS NULL OR related_type IN ('customer', 'quote', 'job', 'invoice', 'project'));

-- Index for the project-scoped Notes feed query.
CREATE INDEX IF NOT EXISTS idx_worklog_project
  ON public.worklog_entries (related_id, created_at DESC)
  WHERE related_type = 'project';

-- 2. project_notes table
CREATE TABLE IF NOT EXISTS public.project_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_notes_project ON public.project_notes (project_id, created_at DESC);

ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

-- Tenant members can read + write their own notes.
CREATE POLICY pn_tenant_select ON public.project_notes
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY pn_tenant_insert ON public.project_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY pn_tenant_delete ON public.project_notes
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
    )
  );
