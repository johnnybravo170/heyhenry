-- RLS policies for worker_invites.
-- Authenticated tenant members can manage their own invites.
-- Anon users can look up valid, unused, unexpired invite codes (for the join page).

ALTER TABLE public.worker_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select_worker_invites ON public.worker_invites
    FOR SELECT TO authenticated
    USING (tenant_id = public.current_tenant_id());

CREATE POLICY tenant_insert_worker_invites ON public.worker_invites
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY tenant_update_worker_invites ON public.worker_invites
    FOR UPDATE TO authenticated
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- Anon can resolve valid, unused, unexpired invites (join page lookup).
CREATE POLICY anon_select_worker_invites ON public.worker_invites
    FOR SELECT TO anon
    USING (used_at IS NULL AND revoked_at IS NULL AND expires_at > now());
