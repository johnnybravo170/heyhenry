-- Extend the intake_source check constraint to include the 'import' value,
-- used by the service-role POST /api/import/project endpoint.
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_intake_source_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_intake_source_check
  CHECK (
    intake_source IS NULL OR intake_source = ANY (ARRAY[
      'manual',
      'text-thread',
      'sms',
      'share-sheet',
      'import'
    ])
  );
