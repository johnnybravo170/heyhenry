-- project_import_hardening
--
-- Adds site address fields to projects so an imported historical project
-- can carry a real job-site address distinct from the customer contact address.
-- start_date already exists (0031); target_end_date already exists (0031).
-- Both are wired into the import schema — no column changes needed for dates.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS site_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS site_city          TEXT,
  ADD COLUMN IF NOT EXISTS site_postal        TEXT;
