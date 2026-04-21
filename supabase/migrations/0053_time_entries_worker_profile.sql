-- Tag time entries with the worker profile that logged them.
-- Nullable so legacy owner/admin entries (pre-workers) remain valid.

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS worker_profile_id UUID
    REFERENCES public.worker_profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_worker_profile
  ON public.time_entries (worker_profile_id);

-- Workers insert/update/delete only their own time entries.
CREATE POLICY time_entries_worker_insert ON public.time_entries
  FOR INSERT
  WITH CHECK (
    worker_profile_id IN (
      SELECT wp.id
      FROM public.worker_profiles wp
      JOIN public.tenant_members tm ON tm.id = wp.tenant_member_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY time_entries_worker_update ON public.time_entries
  FOR UPDATE
  USING (
    worker_profile_id IN (
      SELECT wp.id
      FROM public.worker_profiles wp
      JOIN public.tenant_members tm ON tm.id = wp.tenant_member_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY time_entries_worker_delete ON public.time_entries
  FOR DELETE
  USING (
    worker_profile_id IN (
      SELECT wp.id
      FROM public.worker_profiles wp
      JOIN public.tenant_members tm ON tm.id = wp.tenant_member_id
      WHERE tm.user_id = auth.uid()
    )
  );
