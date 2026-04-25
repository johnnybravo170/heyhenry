-- 0121_project_pulse.sql
-- Project Pulse — no-login client-facing progress page per job. The GC
-- triggers a draft (Henry-written), edits inline, then approves & sends.
-- The client gets an SMS+email with a link to /pulse/<public_code>.
--
-- Drafts live in this table with approved_at = NULL. On approve, we set
-- approved_at + sent_at and stamp who it went to.
--
-- No public RLS policy — the public route uses the service-role admin
-- client and looks up the row by public_code (and only when sent_at IS
-- NOT NULL).

CREATE TABLE IF NOT EXISTS public.pulse_updates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  job_id        UUID NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,

  public_code   TEXT NOT NULL UNIQUE,         -- ~12-char URL-safe random

  title         TEXT NOT NULL,                -- "Your Project — Kitchen Renovation"
  body_md       TEXT NOT NULL,                -- the rendered summary the client sees
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
                -- { completed: [{title}], in_progress: [{title}],
                --   waiting_on_you: [{title, action_url?, deadline?}],
                --   up_next: [{title, estimated_date?}], eta? }

  drafted_by    TEXT NOT NULL DEFAULT 'henry'   -- 'henry' or owner name
    CHECK (drafted_by IN ('henry', 'jonathan', 'owner')),

  approved_by   UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  sent_email_to TEXT,
  sent_sms_to   TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pulse_updates_job_idx
  ON public.pulse_updates (tenant_id, job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pulse_updates_public_idx
  ON public.pulse_updates (public_code)
  WHERE sent_at IS NOT NULL;

ALTER TABLE public.pulse_updates ENABLE ROW LEVEL SECURITY;

-- Owners + admins: full CRUD on their tenant's pulse rows.
CREATE POLICY pulse_owner_admin_all ON public.pulse_updates
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE public.pulse_updates IS
  'Project Pulse — Henry-drafted, GC-approved progress updates sent to the homeowner. The public /pulse/<public_code> route uses the service-role client, so no public RLS policy exists by design.';
