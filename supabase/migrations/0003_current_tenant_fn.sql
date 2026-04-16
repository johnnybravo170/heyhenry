-- 0003_current_tenant_fn.sql
-- The `current_tenant_id()` SECURITY DEFINER function from §13.1 of the plan.
--
-- WHY SECURITY DEFINER: RLS policies need to read tenant_members to decide
-- whether the caller can see a row. If policies called tenant_members with
-- the caller's privileges, policies would recursively check tenant_members'
-- own RLS — infinite recursion or a need for a permissive policy on
-- tenant_members that leaks rows. SECURITY DEFINER runs the query with the
-- function owner's privileges, bypassing RLS for just this lookup.
--
-- WHY NOT JWT CLAIM: Tokens live ~1h. Removing a member from a tenant would
-- leave a stale claim in the JWT until refresh. Reading from tenant_members
-- makes revocation immediate on the next query.

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tm.tenant_id
    FROM public.tenant_members tm
    WHERE tm.user_id = auth.uid()
    LIMIT 1;
$$;

-- Grant execute to both roles Supabase uses.
--   `authenticated` = any signed-in user.
--   `anon` = unauthenticated. The function returns NULL for them (auth.uid()
--     is NULL), which makes every RLS policy fail closed — desirable.
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, anon;

COMMENT ON FUNCTION public.current_tenant_id() IS
    'Returns the tenant_id of the first tenant the current auth user belongs to. SECURITY DEFINER to avoid RLS recursion on tenant_members. See plan §13.1.';
