-- 20260522182520_normalize_existing_customer_phones.sql
-- One-time backfill: normalize existing customers.phone to the canonical
-- storage form, matching src/lib/phone.ts normalizePhone() exactly.
--
-- New writes are normalized at the point of entry (the customer Zod schema +
-- the contact-intake and import inserts). This migration brings the rows that
-- predate that change up to the same canonical shape so the directory shows
-- one consistent format and phone search/dedup match reliably.
--
-- Canonical form: E.164 (+1XXXXXXXXXX) for a 10-digit NANP number (or an
-- 11-digit 1-prefixed one); +<digits> for an already-international number;
-- bare digits for anything we can't confidently parse; NULL for no-digit junk.
-- The helper is created, used, and dropped here — src/lib/phone.ts stays the
-- single long-lived source of truth.

CREATE OR REPLACE FUNCTION pg_temp.normalize_phone(p_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH t AS (SELECT btrim(coalesce(p_input, '')) AS raw),
       d AS (SELECT raw, regexp_replace(raw, '\D', '', 'g') AS digits FROM t)
  SELECT CASE
    WHEN digits = '' THEN NULL
    WHEN left(raw, 1) = '+' THEN '+' || digits
    WHEN length(digits) = 11 AND left(digits, 1) = '1' THEN '+' || digits
    WHEN length(digits) = 10 THEN '+1' || digits
    ELSE digits
  END
  FROM d;
$$;

UPDATE public.customers
SET phone = pg_temp.normalize_phone(phone),
    updated_at = now()
WHERE phone IS NOT NULL
  AND pg_temp.normalize_phone(phone) IS DISTINCT FROM phone;
