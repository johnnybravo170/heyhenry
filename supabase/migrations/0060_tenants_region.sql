-- 0060_tenants_region.sql
-- Tag every tenant with the region their data lives in. Today the only valid
-- value is 'ca-central-1' (Supabase project region). The column exists now so
-- future region expansion is a CHECK widen + per-region routing, not a
-- backfill + RLS rewrite.

ALTER TABLE public.tenants
    ADD COLUMN region TEXT NOT NULL DEFAULT 'ca-central-1'
    CHECK (region IN ('ca-central-1'));

CREATE INDEX idx_tenants_region ON public.tenants (region);
