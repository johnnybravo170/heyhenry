-- 0043_photo_share_links_slug.sql
-- Human-readable URL slug for photo share links.
--
-- The token remains the access key. The slug is cosmetic — renders as
-- `/g/{slug}-{token}`. If a visitor arrives at a mismatched slug, the route
-- 302s to the canonical URL. Nullable because older links predate this
-- feature and keep working on the bare `/g/{token}` form.

ALTER TABLE public.photo_share_links
  ADD COLUMN IF NOT EXISTS slug TEXT;
