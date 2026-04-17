-- Add 'worker' to the tenant_members role CHECK constraint.
-- Plan A (referrals) uses migrations 0024-0027; this is Plan B (worker invites).

ALTER TABLE public.tenant_members
    DROP CONSTRAINT IF EXISTS tenant_members_role_check;

ALTER TABLE public.tenant_members
    ADD CONSTRAINT tenant_members_role_check
    CHECK (role IN ('owner', 'admin', 'member', 'worker'));
