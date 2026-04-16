-- 0004_tenants_rls.sql
-- Enables RLS and installs policies for `tenants` + `tenant_members`.
--
-- Tenant INSERT/DELETE deliberately go through the service_role (admin
-- client) only — a user should never be able to create or delete a tenant
-- through RLS. Tenant creation happens in the signup server action;
-- deletion is a manual/admin operation.

-- === tenants ===

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- SELECT: a user sees the tenant they belong to.
CREATE POLICY tenants_select_own
    ON public.tenants
    FOR SELECT
    TO authenticated
    USING (id = public.current_tenant_id());

-- UPDATE: owners can edit their tenant row. We don't scope to role here;
-- role-based authorization lives at the app layer for now. All we enforce
-- at RLS is the tenant boundary.
CREATE POLICY tenants_update_own
    ON public.tenants
    FOR UPDATE
    TO authenticated
    USING (id = public.current_tenant_id())
    WITH CHECK (id = public.current_tenant_id());

-- No INSERT / DELETE policies by design — service_role only.


-- === tenant_members ===

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- SELECT: a user can see members of their own tenant.
CREATE POLICY tenant_members_select_own
    ON public.tenant_members
    FOR SELECT
    TO authenticated
    USING (tenant_id = public.current_tenant_id());

-- INSERT: a user can invite another user into their own tenant.
-- (The actual role-check — only owners/admins can invite — is enforced in
-- the server action; RLS guarantees they can't add to a tenant they're not in.)
CREATE POLICY tenant_members_insert_own
    ON public.tenant_members
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = public.current_tenant_id());

-- No UPDATE / DELETE policies yet — role changes + removal go through
-- service_role or a server action using the admin client for now.
