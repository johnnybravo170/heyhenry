-- Perf: wrap per-row auth.uid() calls in RLS policies as (select auth.uid())
-- so Postgres evaluates them ONCE per query (InitPlan) instead of once per row.
-- Supabase performance advisor lint `auth_rls_initplan`. Most policies in this
-- project already use the wrapped form; these 7 are the remaining stragglers.
--
-- Pure query-plan optimization: each policy's logical predicate is byte-for-byte
-- identical to before except auth.uid() -> (select auth.uid()). current_tenant_id()
-- is intentionally left unwrapped — it does not trip the lint (it is already a
-- stable scalar; the advisor only flags auth.* / current_setting()). No behaviour
-- change, fully backward-compatible, applies instantly (metadata only).

-- 1. platform_admins — self-read
ALTER POLICY platform_admins_self_read ON public.platform_admins
  USING (user_id = (select auth.uid()));

-- 2. project_schedule_tasks — tenant member ALL
ALTER POLICY project_schedule_tasks_tenant_all ON public.project_schedule_tasks
  USING (
    (tenant_id = current_tenant_id())
    AND (EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE ((tm.user_id = (select auth.uid()))
        AND (tm.tenant_id = project_schedule_tasks.tenant_id)
        AND (tm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
    ))
  )
  WITH CHECK (
    (tenant_id = current_tenant_id())
    AND (EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE ((tm.user_id = (select auth.uid()))
        AND (tm.tenant_id = project_schedule_tasks.tenant_id)
        AND (tm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
    ))
  );

-- 3. project_schedule_dependencies — tenant member ALL
ALTER POLICY psd_tenant_all ON public.project_schedule_dependencies
  USING (
    (tenant_id = current_tenant_id())
    AND (EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE ((tm.user_id = (select auth.uid()))
        AND (tm.tenant_id = project_schedule_dependencies.tenant_id)
        AND (tm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
    ))
  )
  WITH CHECK (
    (tenant_id = current_tenant_id())
    AND (EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE ((tm.user_id = (select auth.uid()))
        AND (tm.tenant_id = project_schedule_dependencies.tenant_id)
        AND (tm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
    ))
  );

-- 4. tenant_deletion_requests — tenant select
ALTER POLICY tdr_tenant_select ON public.tenant_deletion_requests
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE (tm.user_id = (select auth.uid()))
    )
  );

-- 5. tenant_inbound_addresses — tenant select
ALTER POLICY tenant_inbound_addresses_select_tenant ON public.tenant_inbound_addresses
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE (tm.user_id = (select auth.uid()))
    )
  );

-- 6. widget_configs — tenant select
ALTER POLICY widget_configs_select_tenant ON public.widget_configs
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE (tm.user_id = (select auth.uid()))
    )
  );

-- 7. agreement_acceptances — tenant insert
ALTER POLICY agreement_acceptances_tenant_insert ON public.agreement_acceptances
  WITH CHECK (
    (tenant_id = current_tenant_id()) AND (user_id = (select auth.uid()))
  );
