-- 0001_tenants.sql
-- Creates the `tenants` table. Every other tenant-owned table in the system
-- will FK to `tenants.id`.
--
-- RLS policies for this table live in 0004_tenants_rls.sql so the policy
-- DDL can reference the `current_tenant_id()` function (created in 0003).

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    stripe_account_id TEXT,
    stripe_onboarded_at TIMESTAMPTZ,
    stripe_tos_accepted_at TIMESTAMPTZ,
    stripe_tos_version TEXT,
    currency TEXT NOT NULL DEFAULT 'CAD',
    timezone TEXT NOT NULL DEFAULT 'America/Vancouver',
    province TEXT,
    gst_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.05,
    pst_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenants IS 'One row per operator business on the platform. See src/lib/db/schema/tenants.ts.';
COMMENT ON COLUMN public.tenants.gst_rate IS 'Decimal, e.g. 0.0500 for 5%.';
COMMENT ON COLUMN public.tenants.pst_rate IS 'Decimal. BC PST for cleaning services is typically 0; applies to goods-tied materials.';
