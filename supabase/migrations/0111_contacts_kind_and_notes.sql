-- ============================================================
-- Contacts: expand `customers` into a universal contact
-- directory. Previously a customer was strictly an end-client
-- (residential/commercial/agent). Now we also track vendors,
-- sub-trades, inspectors, referral partners, etc.
--
--   kind:     customer | vendor | sub | agent | inspector | referral | other
--   type:     residential | commercial | NULL     (customer-only subtype)
--
-- We intentionally keep the physical column `type` in place and
-- only ADD `kind`. That keeps every existing query working.
-- In code, `type` now reads as "customer subtype" and is only
-- meaningful when kind='customer'.
--
-- Also: introduce `contact_notes` for a threaded, timestamped
-- notes feed per contact. Backfill existing customers.notes as
-- a single seed entry per contact. `customers.notes` is kept
-- for read compatibility during rollout; the app stops writing
-- to it. A later migration will drop the column once nothing
-- reads it.
-- ============================================================

-- 1. Add kind column (defaults everyone to 'customer').
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'customer';

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_kind_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_kind_check
    CHECK (kind IN ('customer','vendor','sub','agent','inspector','referral','other'));

-- 2. Relax the NOT NULL on type (agent rows will have type=NULL going forward).
ALTER TABLE public.customers ALTER COLUMN type DROP NOT NULL;

-- 3. Migrate existing type='agent' rows into kind='agent', type=NULL.
--    Residential and commercial stay as customer subtypes with kind='customer'.
UPDATE public.customers
   SET kind = 'agent', type = NULL
 WHERE type = 'agent';

-- 4. Loosen the type check so it only carries customer-subtype values.
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_type_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_type_check
    CHECK (type IS NULL OR type IN ('residential','commercial'));

-- 5. Invariant: a non-null `type` is only valid for kind='customer'.
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_type_requires_customer_kind;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_type_requires_customer_kind
    CHECK (kind = 'customer' OR type IS NULL);

-- 6. contact_notes feed table.
CREATE TABLE IF NOT EXISTS public.contact_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id   UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  author_type  TEXT NOT NULL CHECK (author_type IN ('operator','worker','henry','customer','system')),
  author_id    UUID,                                   -- tenant_members.id when author_type='operator'; null otherwise
  body         TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,     -- e.g. { "artifact_id": "…", "source": "imported_from_notes_field" }
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_notes_contact ON public.contact_notes(contact_id, created_at DESC);
CREATE INDEX idx_contact_notes_tenant  ON public.contact_notes(tenant_id);

ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_notes_select_own_tenant"
  ON public.contact_notes
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "contact_notes_insert_own_tenant"
  ON public.contact_notes
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "contact_notes_update_own_tenant"
  ON public.contact_notes
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "contact_notes_delete_own_tenant"
  ON public.contact_notes
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- 7. Backfill: every contact with non-empty notes gets one seed entry.
INSERT INTO public.contact_notes (tenant_id, contact_id, author_type, body, metadata, created_at, updated_at)
SELECT tenant_id,
       id,
       'system',
       notes,
       jsonb_build_object('source','imported_from_notes_field'),
       created_at,
       updated_at
  FROM public.customers
 WHERE notes IS NOT NULL
   AND btrim(notes) <> '';

-- Documentation.
COMMENT ON TABLE public.contact_notes IS
  'Threaded notes per contact. Replaces customers.notes text field. Drizzle schema: src/lib/db/schema/contact-notes.ts.';
COMMENT ON COLUMN public.customers.kind IS
  'Contact kind: customer | vendor | sub | agent | inspector | referral | other. Governs which detail-page sections apply. Only kind=customer may have a non-null type.';
COMMENT ON COLUMN public.customers.type IS
  'Customer subtype (residential | commercial | NULL). Meaningful only when kind=customer. Do not conflate with kind.';
COMMENT ON COLUMN public.customers.notes IS
  'Deprecated. App writes go to public.contact_notes. Will be dropped in a later migration once no readers remain.';
