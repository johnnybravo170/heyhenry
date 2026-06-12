-- Gate the public iCal (.ics) feed on a high-entropy per-tenant secret token
-- instead of the guessable, user-chosen `slug` (the same slug used in public
-- quote URLs). The slug-keyed feed leaked the next 90 days of a contractor's
-- jobs — customer name, street address, appointment time, and job notes — to
-- anyone who could guess or enumerate a slug.
--
-- This adds a ~144-bit token. No GRANT/RLS changes: we are ALTERing the
-- existing `public.tenants` table (which already grants to authenticated /
-- service_role), and the calendar route reads it via the admin client.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS calendar_feed_token text;

-- Backfill existing rows with a unique high-entropy token (~144 bits).
UPDATE public.tenants
  SET calendar_feed_token = encode(gen_random_bytes(18), 'hex')
  WHERE calendar_feed_token IS NULL;

-- New rows get a token automatically.
ALTER TABLE public.tenants
  ALTER COLUMN calendar_feed_token SET DEFAULT encode(gen_random_bytes(18), 'hex');

-- Tokens must be unique so a single lookup resolves exactly one tenant.
CREATE UNIQUE INDEX IF NOT EXISTS tenants_calendar_feed_token_key
  ON public.tenants(calendar_feed_token);
