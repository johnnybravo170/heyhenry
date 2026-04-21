-- 0061_provider_credentials.sql
-- Region-scoped credential storage for external providers (payments, tax,
-- payroll). The secret resolver (`src/lib/providers/secrets.ts`) reads this
-- table first and falls back to environment variables. Today only
-- ca-central-1 rows exist; when a second region is added, per-region
-- credentials live here without env-var proliferation.
--
-- Values are stored in plaintext. Access is restricted to the service role
-- (no RLS grant for authenticated/anon). Supabase encrypts at rest.

CREATE TABLE public.provider_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region TEXT NOT NULL,
    provider TEXT NOT NULL,
    key_name TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (region, provider, key_name)
);

CREATE INDEX idx_provider_credentials_lookup
    ON public.provider_credentials (region, provider);

ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;
-- No policies -- service role only. Authenticated/anon cannot read.
