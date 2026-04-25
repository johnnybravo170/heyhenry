-- 0135_tenant_billing_plan.sql
-- Adds the billing/plan columns to `tenants` so the feature-gate middleware
-- has somewhere to read from. Stripe Checkout signup and webhook handler
-- (kanban card 40158ae9) write to these columns; this migration just
-- defines them with safe defaults so existing tenants keep working.
--
-- Plan ranks: starter=1 < growth=2 < pro=3 < scale=4. Enforced in TS, not
-- in the DB, because the rank table changes more often than the schema.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS founding_member BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_plan_check
    CHECK (plan IN ('starter', 'growth', 'pro', 'scale'));

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_subscription_status_check
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid'));

CREATE UNIQUE INDEX IF NOT EXISTS tenants_stripe_customer_id_key
  ON public.tenants (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_stripe_subscription_id_key
  ON public.tenants (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN public.tenants.plan IS
  'Billing tier: starter | growth | pro | scale. Drives feature gating via src/lib/billing/features.ts.';
COMMENT ON COLUMN public.tenants.subscription_status IS
  'Stripe subscription status mirror. past_due/unpaid downgrade behavior to starter at the gate.';
COMMENT ON COLUMN public.tenants.founding_member IS
  'Founding-member rate ($199 CAD). Set manually by platform admin; not selectable in self-serve signup.';
