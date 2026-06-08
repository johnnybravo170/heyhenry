-- Customer-facing invoices move from raw-UUID-keyed public URLs
-- (/view/invoice/[id]) to an unguessable, short `code` — matching the
-- estimate (estimate_approval_code) and change-order (approval_code)
-- convention. A purpose-built code is the right secret for a no-login,
-- PII-bearing page; the visible doc number stops leaking the row id.
--
-- ADDITIVE + NON-DESTRUCTIVE: `id` keeps working everywhere. The public
-- route resolves by code first, then falls back to id, so every existing
-- id-based link a customer already holds keeps resolving. New sends use
-- the code.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS code text;

COMMENT ON COLUMN public.invoices.code IS
  'Unguessable short code for the public pay page (/view/invoice/[code]). '
  'URL-safe, ~16 chars. Backfilled for existing rows; generated for new rows '
  'in the send action. The raw id still resolves the page for legacy links.';

-- Backfill existing rows with a URL-safe code derived from random bytes.
-- base64 → strip +/=, take 16 chars. Collision space is enormous at our
-- scale; the unique index below is the hard guarantee.
UPDATE public.invoices
SET code = substr(
  translate(encode(gen_random_bytes(16), 'base64'), '+/=', ''),
  1, 16
)
WHERE code IS NULL;

-- Unique (partial — only over set codes, so any in-flight insert that
-- hasn't been assigned a code yet doesn't trip the constraint).
CREATE UNIQUE INDEX IF NOT EXISTS invoices_code_key
  ON public.invoices (code)
  WHERE code IS NOT NULL;
