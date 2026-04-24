-- ============================================================
-- Fuzzy name matching for the contacts dedup banner.
--
-- Enable pg_trgm, add a trigram index on customers.name, and a
-- tenant-scoped SQL function that returns similar-named contacts
-- with their similarity score (0.0-1.0). The dedup banner uses the
-- score to distinguish "exact match" from "similar name — maybe
-- the same person" so the operator can still choose to create a
-- new contact for a genuine namesake (two different John Does).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index for sub-linear similarity lookups.
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON public.customers
  USING gin (name gin_trgm_ops);

-- Tenant-scoped similarity search. SECURITY INVOKER so RLS policies
-- still apply; we also hard-filter by tenant_id and deleted_at to be
-- explicit.
CREATE OR REPLACE FUNCTION public.find_similar_contacts(
  p_name        text,
  p_threshold   real    DEFAULT 0.4,
  p_limit       integer DEFAULT 5,
  p_exclude_id  uuid    DEFAULT NULL
)
RETURNS TABLE (
  id         uuid,
  name       text,
  kind       text,
  email      text,
  phone      text,
  similarity real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    c.id,
    c.name,
    c.kind,
    c.email,
    c.phone,
    similarity(c.name, p_name) AS similarity
  FROM public.customers c
  WHERE c.tenant_id = public.current_tenant_id()
    AND c.deleted_at IS NULL
    AND (p_exclude_id IS NULL OR c.id <> p_exclude_id)
    AND similarity(c.name, p_name) >= p_threshold
  ORDER BY similarity(c.name, p_name) DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.find_similar_contacts IS
  'Fuzzy name search for the contacts dedup banner. Returns rows sorted by trigram similarity. Caller should still score phone/email matches separately — those are stronger signals.';
