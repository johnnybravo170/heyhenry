-- 20260524004828_dashboard_section_order
--
-- Per-user, per-tenant ordering of the owner dashboard's top-level
-- sections (Attention / Jobs / Pipeline / Metrics). Stored on the
-- membership row so the preference is scoped to (user, tenant): the
-- same user in two workspaces can arrange each independently.
--
-- NULL means "never customized" → the app falls back to the default
-- order. Stored as a text[] of stable section keys; unknown/new keys
-- are tolerated by the app (filtered on read, appended on write), so
-- adding a future section never corrupts an existing saved order.
--
-- Self-update is already permitted by tenant_members_update_self
-- (migration 0152), so no new RLS policy is needed.

BEGIN;

ALTER TABLE public.tenant_members
  ADD COLUMN IF NOT EXISTS dashboard_section_order text[];

COMMENT ON COLUMN public.tenant_members.dashboard_section_order IS
  'Owner dashboard section order (stable keys). NULL = default order.';

COMMIT;
