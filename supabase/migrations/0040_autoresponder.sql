-- 0040_autoresponder.sql
-- Autoresponder (AR) system — multi-step email + SMS sequences with profile-first
-- contact records, event-based triggers, and per-send policy enforcement.
--
-- Scope: platform-level AR (tenant_id NULL) powers Hey Henry's own marketing.
-- Non-null tenant_id reserves the same tables for per-operator AR later.
-- Phase 1 UI is platform-admin only; tenant exposure is a follow-up.
--
-- All writes happen server-side via the service role (cron worker, MCP tools,
-- admin UI routes). Tenant RLS is installed for the eventual operator surface,
-- but SELECT requires a non-null tenant_id so platform rows never leak into a
-- tenant session.

-- ---------------------------------------------------------------------------
-- ar_contacts — one canonical subscriber record (profile-first).
-- email and/or phone identify the contact within a scope (tenant_id + email
-- unique; tenant_id + phone unique). NULL tenant_id is the platform scope.
-- ---------------------------------------------------------------------------
CREATE TABLE public.ar_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Vancouver',
  locale TEXT NOT NULL DEFAULT 'en',
  source TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_subscribed BOOLEAN NOT NULL DEFAULT true,
  sms_subscribed BOOLEAN NOT NULL DEFAULT true,
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Partial unique indexes: use a sentinel for the platform scope so the
-- NULL-in-unique gotcha doesn't let duplicates sneak in.
CREATE UNIQUE INDEX ar_contacts_email_uniq
  ON public.ar_contacts (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX ar_contacts_phone_uniq
  ON public.ar_contacts (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), phone)
  WHERE phone IS NOT NULL;

CREATE INDEX ar_contacts_tenant_idx ON public.ar_contacts (tenant_id);

-- ---------------------------------------------------------------------------
-- ar_contact_tags — lightweight tagging (state flags, interest, lifecycle).
-- Tag is free-form text, deduped per contact.
-- ---------------------------------------------------------------------------
CREATE TABLE public.ar_contact_tags (
  contact_id UUID NOT NULL REFERENCES public.ar_contacts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  tagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, tag)
);

CREATE INDEX ar_contact_tags_tag_idx ON public.ar_contact_tags (tag);

-- ---------------------------------------------------------------------------
-- ar_templates — reusable email/SMS content. Body is Handlebars-style with
-- merge tags ({{first_name}}, etc.).
-- ---------------------------------------------------------------------------
CREATE TABLE public.ar_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  from_name TEXT,
  from_email TEXT,
  reply_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (channel = 'email' AND subject IS NOT NULL AND (body_html IS NOT NULL OR body_text IS NOT NULL))
    OR (channel = 'sms' AND body_text IS NOT NULL)
  )
);

CREATE INDEX ar_templates_tenant_idx ON public.ar_templates (tenant_id);

-- ---------------------------------------------------------------------------
-- ar_sequences — workflow definition. Versioned: updates bump `version` so
-- active enrollments keep running against the version they started on.
-- ---------------------------------------------------------------------------
CREATE TABLE public.ar_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,

  -- Trigger: how contacts get enrolled.
  trigger_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('manual', 'tag_added', 'event', 'signup')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Re-enrollment policy. If false, a contact who finishes or is currently
  -- enrolled cannot be re-enrolled.
  allow_reenrollment BOOLEAN NOT NULL DEFAULT false,

  -- Send-window overrides. NULL = inherit global defaults.
  email_quiet_start SMALLINT, -- hour 0-23
  email_quiet_end SMALLINT,
  sms_quiet_start SMALLINT,
  sms_quiet_end SMALLINT,
  email_days_of_week SMALLINT[], -- 0=Sun..6=Sat; NULL = all days allowed
  sms_days_of_week SMALLINT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ar_sequences_tenant_idx ON public.ar_sequences (tenant_id);
CREATE INDEX ar_sequences_status_idx ON public.ar_sequences (status) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- ar_steps — step within a sequence at a given version. Active enrollments
-- reference (sequence_id, version, position). Editing a sequence creates a
-- new version's step set; old versions stay intact for in-flight enrollments.
-- ---------------------------------------------------------------------------
CREATE TABLE public.ar_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.ar_sequences(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  position INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'wait', 'branch', 'tag', 'exit')),

  -- Delay before this step runs, relative to the prior step's completion
  -- (or enrollment start for position 0).
  delay_minutes INTEGER NOT NULL DEFAULT 0,

  -- Channel steps point to a template.
  template_id UUID REFERENCES public.ar_templates(id) ON DELETE RESTRICT,

  -- Branch / tag / exit config (e.g., { "if": {"tag": "foo"}, "then_position": 5, "else_position": 6 }).
  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, version, position)
);

CREATE INDEX ar_steps_seq_idx ON public.ar_steps (sequence_id, version, position);

-- ---------------------------------------------------------------------------
-- ar_enrollments — contact x sequence x version. Drives the cron worker.
-- `next_run_at` is the wall-clock time the next step becomes eligible.
-- ---------------------------------------------------------------------------
CREATE TABLE public.ar_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.ar_contacts(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES public.ar_sequences(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled', 'errored')),
  current_position INTEGER NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- The cron worker's hot query: active enrollments due to run.
CREATE INDEX ar_enrollments_due_idx
  ON public.ar_enrollments (next_run_at)
  WHERE status = 'active';

CREATE INDEX ar_enrollments_contact_idx ON public.ar_enrollments (contact_id);
CREATE INDEX ar_enrollments_sequence_idx ON public.ar_enrollments (sequence_id);

-- ---------------------------------------------------------------------------
-- ar_send_log — every send attempt. Keyed by enrollment+step (or broadcast_id
-- for one-off sends). Tracks provider IDs + engagement from webhooks.
-- ---------------------------------------------------------------------------
CREATE TABLE public.ar_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.ar_contacts(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.ar_enrollments(id) ON DELETE SET NULL,
  step_id UUID REFERENCES public.ar_steps(id) ON DELETE SET NULL,
  broadcast_id UUID,

  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  to_address TEXT NOT NULL, -- email or phone
  subject TEXT,

  -- Provider correlation. Resend email id or Twilio SID.
  provider_id TEXT,

  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'suppressed')),
  error_code TEXT,
  error_message TEXT,

  -- Engagement (populated by webhook).
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,

  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ar_send_log_contact_idx ON public.ar_send_log (contact_id, created_at DESC);
CREATE INDEX ar_send_log_enrollment_idx ON public.ar_send_log (enrollment_id);
CREATE INDEX ar_send_log_provider_idx ON public.ar_send_log (provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX ar_send_log_tenant_created_idx ON public.ar_send_log (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- ar_events — event bus. Writers (app code, webhooks, MCP tools) append
-- events; a processor converts events into enrollments for sequences whose
-- trigger_type='event' matches event_type.
-- ---------------------------------------------------------------------------
CREATE TABLE public.ar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.ar_contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX ar_events_unprocessed_idx
  ON public.ar_events (created_at)
  WHERE processed_at IS NULL;

CREATE INDEX ar_events_type_idx ON public.ar_events (event_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- ar_suppression_list — global unsubscribes and hard bounces. Keyed by
-- normalized address. Writes from: unsubscribe route, bounce/complaint
-- webhooks, manual admin action.
--
-- Not tenant-scoped: suppression is always global per address to stay clear
-- of CASL/CAN-SPAM re-contact risk.
-- ---------------------------------------------------------------------------
CREATE TABLE public.ar_suppression_list (
  address TEXT PRIMARY KEY, -- lowercased email or E.164 phone
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual', 'import')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE INDEX ar_suppression_channel_idx ON public.ar_suppression_list (channel);

-- ---------------------------------------------------------------------------
-- RLS — every AR table is tenant-scoped (when tenant_id is set). Platform
-- rows (tenant_id IS NULL) are service-role only, which is enforced by the
-- `tenant_id = current_tenant_id()` predicate (current_tenant_id() returns
-- a real UUID inside a tenant session, so NULL rows never match).
-- ---------------------------------------------------------------------------

-- ar_contacts
ALTER TABLE public.ar_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_select_ar_contacts ON public.ar_contacts
    FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_insert_ar_contacts ON public.ar_contacts
    FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_update_ar_contacts ON public.ar_contacts
    FOR UPDATE TO authenticated
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_delete_ar_contacts ON public.ar_contacts
    FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

-- ar_contact_tags — join through ar_contacts.
ALTER TABLE public.ar_contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_all_ar_contact_tags ON public.ar_contact_tags
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.ar_contacts c
                   WHERE c.id = contact_id AND c.tenant_id = public.current_tenant_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.ar_contacts c
                        WHERE c.id = contact_id AND c.tenant_id = public.current_tenant_id()));

-- ar_templates
ALTER TABLE public.ar_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_select_ar_templates ON public.ar_templates
    FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_insert_ar_templates ON public.ar_templates
    FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_update_ar_templates ON public.ar_templates
    FOR UPDATE TO authenticated
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_delete_ar_templates ON public.ar_templates
    FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

-- ar_sequences
ALTER TABLE public.ar_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_select_ar_sequences ON public.ar_sequences
    FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_insert_ar_sequences ON public.ar_sequences
    FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_update_ar_sequences ON public.ar_sequences
    FOR UPDATE TO authenticated
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY tenant_delete_ar_sequences ON public.ar_sequences
    FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

-- ar_steps — join through ar_sequences.
ALTER TABLE public.ar_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_all_ar_steps ON public.ar_steps
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.ar_sequences s
                   WHERE s.id = sequence_id AND s.tenant_id = public.current_tenant_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.ar_sequences s
                        WHERE s.id = sequence_id AND s.tenant_id = public.current_tenant_id()));

-- ar_enrollments — join through ar_contacts.
ALTER TABLE public.ar_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_select_ar_enrollments ON public.ar_enrollments
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.ar_contacts c
                   WHERE c.id = contact_id AND c.tenant_id = public.current_tenant_id()));
-- Writes go through the service role (cron worker, MCP tools).

-- ar_send_log
ALTER TABLE public.ar_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_select_ar_send_log ON public.ar_send_log
    FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
-- Writes via service role only.

-- ar_events
ALTER TABLE public.ar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_select_ar_events ON public.ar_events
    FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
-- Writes via service role only.

-- ar_suppression_list — global, no RLS. Service-role + server-side reads only.
ALTER TABLE public.ar_suppression_list DISABLE ROW LEVEL SECURITY;
