-- 0002_tenant_members.sql
-- Maps Supabase auth users to tenants with a role. This table is the source
-- of truth for the `current_tenant_id()` function in 0003.
--
-- We intentionally do NOT create a cross-schema foreign key to `auth.users`:
-- the `auth` schema is Supabase-managed, and FK-ing into it complicates
-- migration + restore drills. The invariant is enforced at the app layer.

CREATE TABLE IF NOT EXISTS public.tenant_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tenant_members_tenant_user_unique UNIQUE (tenant_id, user_id)
);

-- Index for the common lookup pattern: "what tenant is this user in?"
-- Used by `current_tenant_id()` on every RLS-checked query. Must be fast.
CREATE INDEX IF NOT EXISTS tenant_members_user_id_idx ON public.tenant_members (user_id);

COMMENT ON TABLE public.tenant_members IS 'Auth user <-> tenant mapping. Authoritative for current_tenant_id().';
COMMENT ON COLUMN public.tenant_members.user_id IS 'Matches auth.users.id. Not FK-ed because auth schema is managed.';
